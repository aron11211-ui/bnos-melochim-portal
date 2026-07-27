import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, isAllowedOrigin } from "../_shared/cors.ts";

type AppRole = "parent" | "registration_office" | "tuition_office" | "school_management" | "super_admin";

type InviteBody = {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role: AppRole;
  family_id?: string;
};

const roles: AppRole[] = ["parent", "registration_office", "tuition_office", "school_management", "super_admin"];
const exactKeys = new Set(["email", "first_name", "last_name", "phone", "role", "family_id"]);
const productionInviteRedirect = "https://bnos-melochim-portal.onrender.com/accept-invitation";

Deno.serve(async (request) => {
  const headers = corsHeaders(request);
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (!isAllowedOrigin(request)) return json(request, { error: "Origin is not allowed." }, 403);
  if (request.method !== "POST") return json(request, { error: "Method not allowed." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return json(request, { error: "Invitation service is not configured." }, 500);

    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(request, { error: "Please sign in before inviting users." }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    const { data: callerData, error: callerError } = await admin.auth.getUser(jwt);
    if (callerError || !callerData.user) return json(request, { error: "Your session could not be verified." }, 401);

    const { data: callerProfile } = await admin
      .from("profiles")
      .select("role,status")
      .eq("id", callerData.user.id)
      .maybeSingle();

    const callerRole = callerProfile?.role as AppRole | undefined;
    if (callerProfile?.status !== "active" || !callerRole) return json(request, { error: "Your account is not active." }, 403);

    const body = validateBody(await request.json().catch(() => null));
    if ("error" in body) return json(request, { error: body.error }, 400);

    if (!canInvite(callerRole, body.role)) {
      return json(request, { error: "You do not have permission to invite that role." }, 403);
    }

    let familyName: string | null = null;
    if (body.role === "parent") {
      if (!body.family_id) return json(request, { error: "Choose a family before inviting a parent." }, 400);
      const { data: family } = await admin
        .from("families")
        .select("id,family_name")
        .eq("id", body.family_id)
        .maybeSingle();
      if (!family) return json(request, { error: "The selected family was not found." }, 400);
      familyName = family.family_name;
    } else if (body.family_id) {
      return json(request, { error: "Family selection is only allowed for parent invitations." }, 400);
    }

    const existingProfile = await findExistingProfile(admin, body.email);
    if (existingProfile?.status === "active") {
      return json(request, { error: "That email already has an active portal account." }, 409);
    }
    if (existingProfile?.status === "disabled") {
      return json(request, { error: "That account is disabled. A Super Admin must reactivate it before it can be used." }, 409);
    }
    if (existingProfile?.id) {
      await safeDeleteAuthUser(admin, existingProfile.id);
      await admin.from("profiles").delete().eq("id", existingProfile.id);
      await recordAudit(admin, callerData.user.id, "retry_invite_cleanup", existingProfile.id, {
        email: body.email,
        prior_status: existingProfile.status,
      });
    }

    const existingAuthUser = await findAuthUserByEmail(admin, body.email);
    if (existingAuthUser?.email_confirmed_at) {
      return json(request, { error: "That email is already registered. Ask a Super Admin to review the account." }, 409);
    }
    if (existingAuthUser?.id) {
      await safeDeleteAuthUser(admin, existingAuthUser.id);
      await recordAudit(admin, callerData.user.id, "retry_invite_auth_cleanup", existingAuthUser.id, {
        email: body.email,
      });
    }

    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(body.email, {
      redirectTo: productionInviteRedirect,
      data: {
        first_name: body.first_name,
        last_name: body.last_name,
        phone: body.phone ?? "",
        role: body.role,
      },
    });

    if (inviteError || !invited.user) {
      return json(request, { error: "The invitation could not be sent. If you requested many emails, wait a few minutes and try again." }, 400);
    }
    const invitedUser = invited.user;

    const profilePayload = {
      id: invitedUser.id,
      email: body.email,
      first_name: body.first_name,
      last_name: body.last_name,
      phone: body.phone ?? null,
      role: body.role,
      status: "invited",
    };

    const { error: profileError } = await admin.from("profiles").upsert(profilePayload, { onConflict: "id" });
    if (profileError) {
      await safeDeleteAuthUser(admin, invitedUser.id);
      await recordAudit(admin, callerData.user.id, "invite_user_profile_failed", invitedUser.id, {
        email: body.email,
        role: body.role,
      });
      return json(request, { error: "Invitation cleanup was completed after profile setup failed. Please try again." }, 500);
    }

    if (body.role === "parent" && body.family_id) {
      const { error: familyUserError } = await admin.from("family_users").upsert(
        {
          family_id: body.family_id,
          user_id: invitedUser.id,
          relationship: "Guardian",
          is_primary_contact: false,
          status: "invited",
          invited_by: callerData.user.id,
          invited_at: new Date().toISOString(),
        },
        { onConflict: "family_id,user_id" },
      );

      if (familyUserError) {
        await admin.from("profiles").update({ status: "pending_verification" }).eq("id", invitedUser.id);
        await recordAudit(admin, callerData.user.id, "invite_user_family_link_failed", invitedUser.id, {
          email: body.email,
          family_id: body.family_id,
        });
        return json(request, { error: "Invitation was sent, but family linking failed. A Super Admin can safely retry." }, 500);
      }
    }

    await recordAudit(admin, callerData.user.id, "invite_user", invitedUser.id, {
      email: body.email,
      role: body.role,
      family_id: body.family_id ?? null,
    });

    return json(request, {
      ok: true,
      email: body.email,
      role: body.role,
      user_id: invitedUser.id,
      family_name: familyName,
      message: familyName ? `Invitation sent to ${body.email} for ${familyName}.` : `Invitation sent to ${body.email}.`,
    });
  } catch {
    return json(request, { error: "Something went wrong while sending the invitation." }, 500);
  }
});

function validateBody(value: unknown): InviteBody | { error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { error: "Invalid invitation request." };
  const body = value as Record<string, unknown>;
  const unknownKey = Object.keys(body).find((key) => !exactKeys.has(key));
  if (unknownKey) return { error: `Unexpected field: ${unknownKey}.` };

  const email = String(body.email ?? "").trim().toLowerCase();
  const firstName = String(body.first_name ?? "").trim();
  const lastName = String(body.last_name ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const role = String(body.role ?? "") as AppRole;
  const familyId = String(body.family_id ?? "").trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  if (!firstName) return { error: "First name is required." };
  if (!lastName) return { error: "Last name is required." };
  if (!roles.includes(role)) return { error: "Choose a valid role." };
  if (familyId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(familyId)) {
    return { error: "Choose a valid family." };
  }

  return { email, first_name: firstName, last_name: lastName, phone, role, family_id: familyId || undefined };
}

function canInvite(callerRole: AppRole, inviteRole: AppRole) {
  if (callerRole === "super_admin") return true;
  if (callerRole === "registration_office") return inviteRole === "parent";
  return false;
}

async function findExistingProfile(admin: ReturnType<typeof createClient>, email: string) {
  const { data } = await admin.from("profiles").select("id,status,role").eq("email", email).maybeSingle();
  return data;
}

async function findAuthUserByEmail(admin: ReturnType<typeof createClient>, email: string) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return null;
    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 1000) return null;
  }
  return null;
}

async function safeDeleteAuthUser(admin: ReturnType<typeof createClient>, userId: string) {
  try {
    await admin.auth.admin.deleteUser(userId);
  } catch {
    // Do not expose cleanup internals to the caller.
  }
}

async function recordAudit(admin: ReturnType<typeof createClient>, actorId: string, action: string, recordId: string, details: Record<string, unknown>) {
  await admin.from("audit_logs").insert({
    actor_id: actorId,
    action,
    table_name: "profiles",
    record_id: recordId,
    details,
  });
}

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json" },
  });
}
