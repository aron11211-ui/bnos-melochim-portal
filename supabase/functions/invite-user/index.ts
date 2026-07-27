import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type AppRole = "parent" | "registration_office" | "tuition_office" | "school_management" | "super_admin";

const allowedRoles: AppRole[] = ["parent", "registration_office", "tuition_office", "school_management", "super_admin"];

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Function is not configured" }, 500);

  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing authorization" }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: caller } = await admin.auth.getUser(token);
  if (!caller.user) return json({ error: "Unauthorized" }, 401);

  const { data: callerProfile } = await admin.from("profiles").select("role,status").eq("id", caller.user.id).single();
  if (callerProfile?.role !== "super_admin" || callerProfile?.status !== "active") return json({ error: "Forbidden" }, 403);

  const body = await request.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  const role = body.role as AppRole;
  const firstName = String(body.firstName ?? "");
  const lastName = String(body.lastName ?? "");
  const redirectTo = String(body.redirectTo ?? `${new URL(request.url).origin}/accept-invitation`);

  if (!email || !allowedRoles.includes(role)) return json({ error: "Invalid invitation request" }, 400);

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { first_name: firstName, last_name: lastName, role },
  });
  if (inviteError || !invited.user) return json({ error: "Unable to send invitation" }, 400);

  const { error: profileError } = await admin.from("profiles").upsert({
    id: invited.user.id,
    email,
    first_name: firstName,
    last_name: lastName,
    role,
    status: "invited",
  });
  if (profileError) return json({ error: "Invitation sent, but profile setup failed" }, 500);

  await admin.from("audit_logs").insert({
    actor_id: caller.user.id,
    action: "invite_user",
    table_name: "profiles",
    record_id: invited.user.id,
    details: { email, role },
  });

  return json({ ok: true, userId: invited.user.id });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
