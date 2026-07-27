import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
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
