import { createClient, type Session } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./f1-shell";

// Shared browser client. Same origin as /app/index.html iframe, so both
// the React shell and the legacy analyzer share one localStorage session.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "sb-kbjjtiajugxvhoboqxwb-auth-token",
  },
});

// Usernames are stored as pseudo-emails since Supabase Auth requires email.
export function usernameToEmail(username: string) {
  const value = username.trim().toLowerCase();
  if (value.includes("@")) return value;
  return `${value.replace(/[^a-z0-9_.-]/g, "")}@f1.local`;
}

export function displayNameFromSession(s: Session | null): string {
  if (!s?.user?.email) return "";
  return s.user.email.replace(/@f1\.local$/, "");
}

// NOTE: the previous "claim orphan rows" helper was removed. It relied on an
// RLS policy letting any signed-in user take ownership of rows with a NULL
// user_id, which allowed one account to steal another's legacy data.
// Legacy rows must be assigned to their owner with a one-off SQL UPDATE run
// by the project owner (see SETUP_AUTH.sql).

