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

// One-time claim: after login, attach every orphan row to this user.
export async function claimOrphanRows() {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData?.user?.id;
  if (!uid) return;
  for (const table of ["telemetry_sessions", "driver_teams", "track_notes"] as const) {
    try {
      await supabase.from(table).update({ user_id: uid }).is("user_id", null);
    } catch (e) {
      console.warn("claim orphans failed on", table, e);
    }
  }
}
