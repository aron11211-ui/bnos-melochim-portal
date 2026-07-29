import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, isAllowedOrigin } from "../_shared/cors.ts";

type CreateParentBody = {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  family_id: string;
};

const exactKeys = new Set(["email", "first_name", "last_name", "phone", "family_id"]);

Deno.serve(async (request) => {
  const headers = corsHeaders(request);
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (!isAllowedOrigin(request)) return json(request, { error: "Origin is not allowed." }, 403);
  if (request.method !== "POST") return json(request, { error: "Method not allowed." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return json(request, { error: "Parent account service is not configured." }, 500);

    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(request, { error: "Please sign in before creating accounts." }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    const { data: callerData, error: callerError } = await admin.auth.getUser(jwt);
    if (callerError || !callerData.user) return json(request, { error: "Your session could not be verified." }, 401);

    const { data: callerProfile } = await admin
      .from("profiles")
      .select("role,status")
      .eq("id", callerData.user.id)
      .maybeSingle();

    if (callerProfile?.status !== "active" || callerProfile?.role !== "super_admin") {
      return json(request, { error: "Only System Administration can create parent logins directly." }, 403);
    }

    const body = validateBody(await request.json().catch(() => null));
    if ("error" in body) return json(request, { error: body.error }, 400);

    const { data: family } = await admin
      .from("families")
      .select("id,family_name,family_code")
      .eq("id", body.family_id)
      .maybeSingle();
    if (!family) return json(request, { error: "The selected family was not found." }, 400);

    const temporaryPassword = createTemporaryPassword();
    const existingAuthUser = await findAuthUserByEmail(admin, body.email);
    let userId = existingAuthUser?.id ?? "";

    if (userId) {
      const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
        email: body.email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          first_name: body.first_name,
          last_name: body.last_name,
          phone: body.phone ?? "",
        },
        app_metadata: { role: "parent" },
      });
      if (updateError) return json(request, { error: "Existing parent account could not be updated." }, 400);
    } else {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: body.email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          first_name: body.first_name,
          last_name: body.last_name,
          phone: body.phone ?? "",
        },
        app_metadata: { role: "parent" },
      });
      if (createError || !created.user) return json(request, { error: safeCreateError(createError?.message) }, 400);
      userId = created.user.id;
    }

    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: userId,
        email: body.email,
        first_name: body.first_name,
        last_name: body.last_name,
        phone: body.phone ?? null,
        role: "parent",
        status: "active",
      },
      { onConflict: "id" },
    );
    if (profileError) return json(request, { error: "Parent profile could not be saved." }, 500);

    const { error: familyUserError } = await admin.from("family_users").upsert(
      {
        family_id: body.family_id,
        user_id: userId,
        relationship: "Guardian",
        is_primary_contact: false,
        status: "active",
        invited_by: callerData.user.id,
        invited_at: new Date().toISOString(),
      },
      { onConflict: "family_id,user_id" },
    );
    if (familyUserError) return json(request, { error: "Parent account was created, but family access could not be linked." }, 500);

    await admin.from("audit_logs").insert({
      actor_id: callerData.user.id,
      action: existingAuthUser ? "reset_parent_temporary_password" : "create_parent_account",
      table_name: "profiles",
      record_id: userId,
      details: {
        email: body.email,
        family_id: body.family_id,
        family_name: family.family_name,
      },
    });

    return json(request, {
      ok: true,
      email: body.email,
      temporary_password: temporaryPassword,
      user_id: userId,
      family_name: family.family_name,
      family_code: family.family_code,
      message: `Parent login created for ${body.email}.`,
    });
  } catch {
    return json(request, { error: "Something went wrong while creating the parent account." }, 500);
  }
});

function validateBody(value: unknown): CreateParentBody | { error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { error: "Invalid parent account request." };
  const body = value as Record<string, unknown>;
  const unknownKey = Object.keys(body).find((key) => !exactKeys.has(key));
  if (unknownKey) return { error: `Unexpected field: ${unknownKey}.` };

  const email = String(body.email ?? "").trim().toLowerCase();
  const firstName = String(body.first_name ?? "").trim();
  const lastName = String(body.last_name ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const familyId = String(body.family_id ?? "").trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  if (!firstName) return { error: "First name is required." };
  if (!lastName) return { error: "Last name is required." };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(familyId)) {
    return { error: "Choose a family before creating a parent login." };
  }

  return { email, first_name: firstName, last_name: lastName, phone, family_id: familyId };
}

function createTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
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

function safeCreateError(message = "") {
  const normalized = message.toLowerCase();
  if (normalized.includes("already")) return "That email already exists. Use Create Parent Login again to reset the temporary password.";
  if (normalized.includes("password")) return "The temporary password did not meet Supabase requirements.";
  return "The parent account could not be created.";
}

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json" },
  });
}
