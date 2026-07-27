import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type AppRole = "parent" | "registration_office" | "tuition_office" | "school_management" | "super_admin";
type AccountStatus = "active" | "invited" | "disabled" | "pending_verification";

const allowedRoles: AppRole[] = ["parent", "registration_office", "tuition_office", "school_management", "super_admin"];
const allowedStatuses: AccountStatus[] = ["active", "invited", "disabled", "pending_verification"];

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
  const userId = String(body.userId ?? "");
  const role = body.role as AppRole | undefined;
  const status = body.status as AccountStatus | undefined;

  if (!userId) return json({ error: "Missing userId" }, 400);
  if (role && !allowedRoles.includes(role)) return json({ error: "Invalid role" }, 400);
  if (status && !allowedStatuses.includes(status)) return json({ error: "Invalid status" }, 400);
  if (caller.user.id === userId && status === "disabled") return json({ error: "A super admin cannot disable their own active session" }, 400);

  const patch: Record<string, unknown> = {};
  if (role) patch.role = role;
  if (status) {
    patch.status = status;
    patch.disabled_at = status === "disabled" ? new Date().toISOString() : null;
  }

  const { error } = await admin.from("profiles").update(patch).eq("id", userId);
  if (error) return json({ error: "Unable to update user access" }, 400);

  if (status === "disabled") {
    await admin.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
  } else if (status === "active") {
    await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
  }

  await admin.from("audit_logs").insert({
    actor_id: caller.user.id,
    action: "update_user_access",
    table_name: "profiles",
    record_id: userId,
    details: patch,
  });

  return json({ ok: true });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
