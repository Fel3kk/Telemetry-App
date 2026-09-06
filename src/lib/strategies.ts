// Tyre strategies stored per track (shared across every season / session of
// that track) and scoped to the signed-in user + active career slot.

import { supabase } from "./supabase";

// Race distance (laps) per track, as run in this career (50% distance).
export const TRACK_LAPS: Record<string, number> = {
  melbourne: 29, shanghai: 28, suzuka: 27, sakhir: 29, jeddah: 25,
  miami: 29, imola: 32, monaco: 39, catalunya: 33, montreal: 35,
  austria: 36, austria_reverse: 36, silverstone: 26, spa: 22, hungaroring: 35,
  zandvoort: 36, monza: 27, madrid: 29, baku: 26, singapore: 31,
  texas: 28, mexico: 36, brazil: 36, vegas: 25, losail: 29,
  abu_dhabi: 29,
};

export function trackLapLimit(trackKey: string): number | null {
  return TRACK_LAPS[trackKey] ?? null;
}


export type Compound = "Soft" | "Medium" | "Hard" | "Intermediate" | "Wet";

export const COMPOUNDS: Compound[] = ["Soft", "Medium", "Hard", "Intermediate", "Wet"];

export const COMPOUND_COLOR: Record<string, string> = {
  Soft: "#ef3340",
  Medium: "#f4d03f",
  Hard: "#e8e8e8",
  Intermediate: "#27ae60",
  Wet: "#2e86de",
};

export const COMPOUND_SHORT: Record<string, string> = {
  Soft: "S",
  Medium: "M",
  Hard: "H",
  Intermediate: "I",
  Wet: "W",
};

export function compoundText(c: string) {
  return c === "Hard" || c === "Medium" ? "#111" : "#fff";
}

export type StrategyStint = { compound: string; start_lap: number; end_lap: number };

export type Strategy = {
  id: string;
  user_id?: string;
  career_slot: string | null;
  track_key: string;
  season: number | null;
  name: string;
  notes: string;
  source: "race" | "custom";
  stints: StrategyStint[];
  created_at?: string;
  updated_at?: string;
};

export function stintLaps(s: StrategyStint) {
  return Math.max(0, Number(s.end_lap) - Number(s.start_lap) + 1);
}

export function totalLaps(stints: StrategyStint[]) {
  return stints.reduce((a, s) => a + stintLaps(s), 0);
}

// Recompute contiguous lap ranges from per-stint lap counts.
export function relayStints(stints: StrategyStint[]): StrategyStint[] {
  let lap = 1;
  return stints.map((s) => {
    const len = Math.max(1, stintLaps(s));
    const out = { compound: s.compound, start_lap: lap, end_lap: lap + len - 1 };
    lap += len;
    return out;
  });
}

export function formatStrategy(stints: StrategyStint[]) {
  return stints
    .map((s) => `${COMPOUND_SHORT[s.compound] ?? "?"} ${s.start_lap}–${s.end_lap}`)
    .join(" · ");
}

export async function listStrategies(trackKey: string): Promise<Strategy[]> {
  // Universal per track: shared across every season and career slot.
  const { data, error } = await supabase
    .from("tyre_strategies")
    .select("*")
    .eq("track_key", trackKey)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(normalize);
}


function normalize(row: any): Strategy {
  return {
    ...row,
    notes: row.notes ?? "",
    source: row.source === "race" ? "race" : "custom",
    stints: Array.isArray(row.stints) ? row.stints : [],
  };
}

export async function createStrategy(input: {
  track_key: string;
  season?: number | null;
  name: string;
  notes?: string;
  source?: "race" | "custom";
  stints: StrategyStint[];
}): Promise<Strategy> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData?.user?.id;
  if (!uid) throw new Error("Sign in to save strategies");
  const payload = {
    user_id: uid,
    career_slot: null,
    track_key: input.track_key,
    season: null,


    name: input.name,
    notes: input.notes ?? "",
    source: input.source ?? "custom",
    stints: input.stints,
  };
  const { data, error } = await supabase.from("tyre_strategies").insert(payload).select("*").single();
  if (error) throw error;
  return normalize(data);
}

export async function updateStrategy(id: string, patch: Partial<Strategy>): Promise<void> {
  const { error } = await supabase
    .from("tyre_strategies")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteStrategy(id: string): Promise<void> {
  const { error } = await supabase.from("tyre_strategies").delete().eq("id", id);
  if (error) throw error;
}
