import type { SupabaseClient } from "@supabase/supabase-js";
import type { DebriefSession } from "./race-debrief";
import { trackSlug } from "./f1-shell";

export type DebriefSessionRow = DebriefSession & { id: string; created_at?: string };

export function isSprintDebriefSession(
  session: Pick<DebriefSession, "category" | "session_type">,
) {
  return /sprint|shootout/i.test(`${session.category} ${session.session_type ?? ""}`);
}

export function debriefSessionLabel(
  session: Pick<DebriefSession, "category" | "session_type">,
) {
  if (
    /sprint/i.test(session.category) &&
    session.session_type &&
    !/sprint/i.test(session.session_type)
  ) {
    return `${session.category} · ${session.session_type}`;
  }
  return session.session_type || session.category;
}

export async function fetchDebriefSessions(
  client: SupabaseClient,
  options: { season: number; track: string; cat: string; career: string | null },
): Promise<DebriefSessionRow[]> {
  // Alias the stored column names to the fields consumed by debrief facts.
  let query = client
    .from("telemetry_sessions")
    .select(
      "id,driver_name,track_name,category,session_type,starting_position:starting_pos,finishing_position:finishing_pos,lap_history,other_driver_lap_histories,race_story,results,created_at",
    )
    .eq("season", options.season);
  if (options.career) query = query.eq("career_slot", options.career);
  const { data, error } = await query;
  if (error) throw error;
  const rows = ((data ?? []) as DebriefSessionRow[]).filter((session) => {
    return trackSlug(session.track_name) === trackSlug(options.track);
  });
  const rank = (session: DebriefSessionRow) =>
    /race/i.test(session.category) ? 0 : /quali/i.test(session.category) ? 1 : 2;
  const preferredCategory = (session: DebriefSessionRow) =>
    isSprintDebriefSession(session) === (options.cat.toLowerCase() === "sprint") ? 0 : 1;
  return rows.sort(
    (a, b) => preferredCategory(a) - preferredCategory(b) || rank(a) - rank(b),
  );
}
