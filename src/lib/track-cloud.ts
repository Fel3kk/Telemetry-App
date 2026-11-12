// Per-user track data (racing lines, ERS maps) saved to the account so it
// follows the driver across devices. Browser-only; RLS limits rows to the owner.
import { supabase } from "./supabase";

export type TrackDataKind = "racing_line" | "ers";

async function userId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function loadTrackData<T>(kind: TrackDataKind, slug: string): Promise<T | null> {
  const uid = await userId();
  if (!uid) return null;
  const { data, error } = await supabase.from("user_track_data").select("data")
    .eq("user_id", uid).eq("kind", kind).eq("track_slug", slug).maybeSingle();
  if (error) throw error;
  return (data?.data as T) ?? null;
}

/** Returns false when nobody is signed in (data stays on this device only). */
export async function saveTrackData(kind: TrackDataKind, slug: string, value: unknown): Promise<boolean> {
  const uid = await userId();
  if (!uid) return false;
  const { error } = await supabase.from("user_track_data").upsert(
    { user_id: uid, kind, track_slug: slug, data: value, updated_at: new Date().toISOString() },
    { onConflict: "user_id,kind,track_slug" },
  );
  if (error) throw error;
  const saved = await loadTrackData<unknown>(kind, slug);
  if (JSON.stringify(saved) !== JSON.stringify(value)) {
    // JSONB may reorder object keys; compare canonical values instead.
    if (canonical(saved) !== canonical(value)) throw new Error("The saved map could not be verified. Try saving again.");
  }
  return true;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => `${JSON.stringify(key)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
