import type { SupabaseClient } from "@supabase/supabase-js";
import type { DebriefSession } from "./race-debrief";
import { trackSlug } from "./f1-shell";

export type DebriefSessionRow = DebriefSession & { id: string; created_at?: string };

export async function fetchDebriefSessions(
  client: SupabaseClient,
  options: { season: number; track: string; cat: string; career: string | null },
): Promise<DebriefSessionRow[]> {
  // Alias the stored column names to the fields consumed by debrief facts.
  let query = client.from("telemetry_sessions")
    .select("id,driver_name,track_name,category,session_type,starting_position:starting_pos,finishing_position:finishing_pos,lap_history,race_story,results,created_at")
    .eq("season", options.season);
  if (options.career) query = query.eq("career_slot", options.career);
  const { data, error } = await query;
  if (error) throw error;
  const rows = ((data ?? []) as DebriefSessionRow[]).filter((session) => {
    const sprint = /sprint|shootout/i.test(`${session.category} ${session.session_type}`);
    return trackSlug(session.track_name) === trackSlug(options.track) &&
      (options.cat === "Sprint" ? sprint : !sprint);
  });
  const rank = (session: DebriefSessionRow) => /race/i.test(session.category) ? 0 : /quali/i.test(session.category) ? 1 : 2;
  return rows.sort((a, b) => rank(a) - rank(b));
}