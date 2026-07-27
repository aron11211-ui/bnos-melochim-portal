import { createClient } from "@supabase/supabase-js";

function cleanEnvValue(value: unknown, key: string) {
  return String(value ?? "")
    .trim()
    .replace(new RegExp(`^${key}\\s*=\\s*`), "")
    .split(/\s+/)[0]
    .trim();
}

const supabaseUrl = cleanEnvValue(import.meta.env.VITE_SUPABASE_URL, "VITE_SUPABASE_URL");
const supabaseAnonKey = cleanEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY, "VITE_SUPABASE_ANON_KEY");

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export const isSupabaseConfigured = Boolean(isHttpUrl(supabaseUrl) && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
        storageKey: "bnos-melochim-auth",
      },
    })
  : null;

export type AppRole = "parent" | "registration_office" | "tuition_office" | "school_management" | "super_admin";

export type Profile = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: AppRole;
  status: "pending_verification" | "active" | "disabled" | "invited";
  disabled_at: string | null;
};
