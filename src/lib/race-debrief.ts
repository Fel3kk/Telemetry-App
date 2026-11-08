// Pure race/quali pre-processing for the AI Race Engineer debrief and the
// consistency score. Keeps the prompt small and the numbers deterministic.
import { driverMatches } from "./driver-identity";

export type DebriefLap = {
  lap: number;
  pit_status?: number | string;
  sc_status?: number | string;
  lap_time?: string;
  s1?: string; s2?: string; s3?: string;
  current_tyre_compound?: string;
  fuel_kg?: number;
  tyre_wear?: { FL?: number; FR?: number; RL?: number; RR?: number };
  ers_deployed_j?: number;
  damage?: Record<string, number | boolean>;
  is_valid?: boolean;
  invalid?: boolean;
  out_lap?: boolean;
  in_lap?: boolean;
};

export function lapSeconds(value: unknown): number | null {
  const m = String(value ?? "").trim().match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const s = Number(m[1] || 0) * 60 + Number(m[2]);
  return s > 0 ? s : null;
}

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Reference lap the spread is scaled to, so short and long tracks compare fairly. */
export const REFERENCE_LAP_S = 90;
/** Residual cap: one big mistake costs points but can't erase a whole stint. */
export const RESIDUAL_CAP_S = 1.5;
/** Spread (seconds, scaled to a 90 s lap) that scores 50/100. */
export const HALF_SCORE_SPREAD_S = 0.7;
/** A clean lap this far above the stint trend counts as a mistake lap. */
export const MISTAKE_S = 1.0;

/** Score from spread around the stint trend line. 0.1 s ≈ 95, 0.3 s ≈ 78, 0.6 s ≈ 56, 1 s ≈ 37. */
export function scoreFromSpread(spread: number): number {
  if (!Number.isFinite(spread) || spread < 0) return 0;
  return Math.round((100 / (1 + Math.pow(spread / HALF_SCORE_SPREAD_S, 1.5))) * 10) / 10;
}

export type StintConsistency = {
  stint: number;
  compound: string;
  firstLap: number;
  lastLap: number;
  cleanLaps: number;
  /** Seconds per lap the stint trend changes (negative = getting faster, fuel burn). */
  trend: number;
  /** RMS spread around the trend, seconds. */
  spread: number;
  mistakeLaps: number[];
};

export type Consistency = {
  score: number | null;
  spread: number | null;
  scaledSpread: number | null;
  cleanLaps: number;
  stints: StintConsistency[];
  mistakeLaps: number[];
  excluded: { lap: number; reason: string }[];
};

export function splitStints(laps: DebriefLap[]): DebriefLap[][] {
  const groups: DebriefLap[][] = [];
  let cur: DebriefLap[] = [];
  let compound = laps[0]?.current_tyre_compound;
  for (const [i, l] of laps.entries()) {
    const nextCompound = l.current_tyre_compound;
    const sustained = nextCompound && nextCompound === laps[i + 1]?.current_tyre_compound;
    if (cur.length && nextCompound && nextCompound !== compound && sustained) {
      groups.push(cur);
      cur = [];
    }
    compound = cur.length ? compound : (sustained || Number(l.pit_status || 0) > 0 ? nextCompound : compound || nextCompound);
    cur.push({ ...l, current_tyre_compound: compound });
    if (Number(l.pit_status || 0) > 0) {
      groups.push(cur);
      cur = [];
      compound = undefined;
    }
  }
  if (cur.length) groups.push(cur);
  return groups;
}

/** Recorded pit flags or a sustained compound transition, never a one-lap glitch. */
export function verifiedPitLaps(laps: DebriefLap[]): number[] {
  const recorded = laps.filter((l) => Number(l.pit_status || 0) > 0).map((l) => l.lap);
  const groups = splitStints(laps);
  for (let i = 1; i < groups.length; i++) {
    const previous = groups[i - 1].at(-1);
    if (previous) recorded.push(previous.lap);
  }
  return [...new Set(recorded)].sort((a, b) => a - b);
}

export function classifyQualifyingLaps(laps: DebriefLap[]) {
  const sorted = [...laps].sort((a, b) => a.lap - b.lap);
  const valid = (l: DebriefLap) => l.is_valid !== false && !l.invalid && Number(l.sc_status || 0) === 0;
  const candidates = sorted.filter((l, i) => valid(l) && !l.out_lap && !l.in_lap && Number(l.pit_status || 0) === 0 && !(i > 0 && Number(sorted[i - 1].pit_status || 0) > 0));
  const times = candidates.map((l) => lapSeconds(l.lap_time)).filter((t): t is number => t !== null);
  const best = times.length ? Math.min(...times) : null;
  return sorted.map((l, i) => {
    const time = lapSeconds(l.lap_time);
    const role = l.in_lap || Number(l.pit_status || 0) > 0 ? "in-lap" :
      l.out_lap || (i > 0 && Number(sorted[i - 1].pit_status || 0) > 0) ? "out-lap" :
      !valid(l) || time === null ? "invalid" :
      best !== null && time <= best * 1.08 + 1e-9 ? "push" : "cooldown/recharge";
    return { lap: l.lap, role, time_s: time };
  });
}

/**
 * Race consistency: per stint, fit a straight trend through clean laps (this
 * absorbs fuel burn-off and steady tyre wear), then measure how far each lap
 * strays from that trend. Spread is scaled to a 90 s lap and weighted by
 * clean laps per stint.
 */
export function raceConsistency(laps: DebriefLap[]): Consistency {
  const sorted = [...laps].filter((l) => Number(l.lap) > 0).sort((a, b) => a.lap - b.lap);
  const pitLaps = new Set(verifiedPitLaps(sorted));
  const neutralLaps = new Set(sorted.filter((l) => Number(l.sc_status || 0) > 0).map((l) => l.lap));
  const excluded: { lap: number; reason: string }[] = [];
  const isClean = (l: DebriefLap) => {
    const why =
      l.lap === 1 ? "Lap 1" :
      pitLaps.has(l.lap) ? "Pit lap" :
      pitLaps.has(l.lap - 1) ? "Out lap" :
      neutralLaps.has(l.lap) ? "Safety car / VSC / red flag" :
      neutralLaps.has(l.lap - 1) ? "Restart lap" :
      lapSeconds(l.lap_time) === null ? "No time" : "";
    if (why) excluded.push({ lap: l.lap, reason: why });
    return !why;
  };
  const candidates = sorted.filter(isClean);
  const best = Math.min(...candidates.map((l) => lapSeconds(l.lap_time) ?? Infinity));
  const clean = new Set(candidates.filter((l) => {
    // Only clearly non-racing laps (e.g. an unflagged red flag) are dropped;
    // ordinary slow laps stay in and are capped, so they still cost points.
    const ok = (lapSeconds(l.lap_time) ?? Infinity) <= best * 1.3;
    if (!ok) excluded.push({ lap: l.lap, reason: "Over 130% of best lap" });
    return ok;
  }).map((l) => l.lap));

  const stints: StintConsistency[] = [];
  splitStints(sorted).forEach((group, i) => {
    const pts = group.filter((l) => clean.has(l.lap)).map((l) => ({ x: l.lap, y: lapSeconds(l.lap_time) ?? 0 }));
    if (pts.length < 3) return;
    const n = pts.length;
    const mx = pts.reduce((a, p) => a + p.x, 0) / n;
    const my = pts.reduce((a, p) => a + p.y, 0) / n;
    const sxx = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0);
    // Short stints don't support a reliable slope; assume typical fuel burn.
    const slope = n >= 4 && sxx > 0 ? pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0) / sxx : -0.06;
    const residuals = pts.map((p) => p.y - (my + slope * (p.x - mx)));
    const capped = residuals.map((r) => Math.max(-RESIDUAL_CAP_S, Math.min(RESIDUAL_CAP_S, r)));
    const dof = Math.max(1, n - (n >= 4 ? 2 : 1));
    const spread = Math.sqrt(capped.reduce((a, r) => a + r * r, 0) / dof);
    stints.push({
      stint: i + 1,
      compound: group[0]?.current_tyre_compound || "",
      firstLap: group[0].lap,
      lastLap: group[group.length - 1].lap,
      cleanLaps: n,
      trend: Math.round(slope * 1000) / 1000,
      spread: Math.round(spread * 1000) / 1000,
      mistakeLaps: pts.filter((_, k) => residuals[k] > MISTAKE_S).map((p) => p.x),
    });
  });

  const cleanLaps = stints.reduce((a, s) => a + s.cleanLaps, 0);
  excluded.sort((a, b) => a.lap - b.lap);
  if (!cleanLaps) return { score: null, spread: null, scaledSpread: null, cleanLaps: 0, stints, mistakeLaps: [], excluded };
  const spread = stints.reduce((a, s) => a + s.spread * (s.cleanLaps / cleanLaps), 0);
  const ref = median(sorted.filter((l) => clean.has(l.lap)).map((l) => lapSeconds(l.lap_time) ?? 0));
  const scaled = spread * (REFERENCE_LAP_S / ref);
  return {
    score: scoreFromSpread(scaled),
    spread: Math.round(spread * 1000) / 1000,
    scaledSpread: Math.round(scaled * 1000) / 1000,
    cleanLaps,
    stints,
    mistakeLaps: stints.flatMap((s) => s.mistakeLaps),
    excluded,
  };
}

const avgWear = (w?: DebriefLap["tyre_wear"]) =>
  w ? ((w.FL ?? 0) + (w.FR ?? 0) + (w.RL ?? 0) + (w.RR ?? 0)) / 4 : 0;

export type DebriefSession = {
  track_name: string;
  category: string;
  session_type?: string | null;
  driver_name?: string;
  starting_position?: number | null;
  finishing_position?: number | null;
  lap_history?: DebriefLap[];
  race_story?: any;
  results?: any[];
};

const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** Compact, number-only summary of one session for the model. */
export function buildDebriefFacts(s: DebriefSession) {
  const laps = (s.lap_history ?? []).filter((l) => Number(l?.lap) > 0).sort((a, b) => a.lap - b.lap);
  const isQuali = /quali|shootout/i.test(`${s.category} ${s.session_type ?? ""}`);
  const consistency = isQuali ? null : raceConsistency(laps);
  const times = laps.map((l) => lapSeconds(l.lap_time)).filter((t): t is number => t !== null);
  const bestLap = times.length ? Math.min(...times) : null;

  const stints = splitStints(laps).map((g, i) => {
    const first = g[0];
    const last = g[g.length - 1];
    const wear = avgWear(last.tyre_wear) - avgWear(first.tyre_wear);
    const t = g.map((l) => lapSeconds(l.lap_time)).filter((x): x is number => x !== null);
    return {
      stint: i + 1,
      compound: first.current_tyre_compound || "",
      laps: `${first.lap}-${last.lap}`,
      length: g.length,
      avg_wear_per_lap_pct: g.length > 1 ? r3(wear / (g.length - 1)) : null,
      end_wear_pct: r3(avgWear(last.tyre_wear)),
      worst_tyre_end_pct: last.tyre_wear ? r3(Math.max(last.tyre_wear.FL ?? 0, last.tyre_wear.FR ?? 0, last.tyre_wear.RL ?? 0, last.tyre_wear.RR ?? 0)) : null,
      best_lap_s: t.length ? r3(Math.min(...t)) : null,
      median_lap_s: t.length ? r3(median(t)) : null,
    };
  });

  const story = s.race_story ?? {};
  const player = String(story.player_name || s.driver_name || "").toUpperCase();
  const cls: any[] = Array.isArray(story.classification) ? story.classification : [];
  const me = cls.find((c) => driverMatches(c.name, player));
  const nearby = me
    ? cls.filter((c) => Math.abs(Number(c.position) - Number(me.position)) <= 2 && c !== me)
        .map((c) => ({ pos: c.position, name: c.name, team: c.team, best_lap: c.best_lap_str, pits: c.pits, status: c.status }))
    : [];

  const lastLap = laps[laps.length - 1];
  const damage = lastLap?.damage
    ? Object.fromEntries(Object.entries(lastLap.damage).filter(([, v]) => (typeof v === "number" ? v > 0 : v === true)))
    : {};

  let quali: unknown = null;
  if (isQuali && Array.isArray(s.results)) {
    const rows = s.results.map((r) => ({ pos: Number(r.position), name: String(r.name || ""), best: lapSeconds(r.best_lap), s1: lapSeconds(r.s1), s2: lapSeconds(r.s2), s3: lapSeconds(r.s3) }));
    const mine = rows.find((r) => driverMatches(r.name, s.driver_name));
    const pole = rows.find((r) => r.pos === 1);
    const ahead = mine ? rows.find((r) => r.pos === mine.pos - 1) : undefined;
    const gap = (a?: number | null, b?: number | null) => (a != null && b != null ? r3(a - b) : null);
    quali = mine ? {
      position: mine.pos,
      best_lap_s: mine.best,
      gap_to_pole_s: gap(mine.best, pole?.best),
      gap_to_car_ahead_s: gap(mine.best, ahead?.best),
      sector_gap_to_pole_s: pole ? [gap(mine.s1, pole.s1), gap(mine.s2, pole.s2), gap(mine.s3, pole.s3)] : null,
      sector_gap_to_car_ahead_s: ahead ? [gap(mine.s1, ahead.s1), gap(mine.s2, ahead.s2), gap(mine.s3, ahead.s3)] : null,
      field_size: rows.length,
    } : null;
  }

  const fuelStart = laps[0]?.fuel_kg ?? null;
  const fuelEnd = lastLap?.fuel_kg ?? null;
  return {
    track: s.track_name,
    session: s.session_type || s.category,
    category: s.category,
    driver: s.driver_name,
    grid: s.starting_position ?? null,
    finish: s.finishing_position ?? null,
    status: me?.status || null,
    points: me?.points ?? null,
    laps_completed: laps.length,
    best_lap_s: bestLap !== null ? r3(bestLap) : null,
    pit_laps: verifiedPitLaps(laps),
    qualifying_laps: isQuali ? classifyQualifyingLaps(laps) : null,
    push_lap_times_s: isQuali ? classifyQualifyingLaps(laps).filter((l) => l.role === "push").map((l) => l.time_s) : null,
    safety_car_laps: laps.filter((l) => Number(l.sc_status || 0) > 0).map((l) => l.lap),
    fuel_used_kg: fuelStart !== null && fuelEnd !== null ? r3(fuelStart - fuelEnd) : null,
    fuel_left_kg: fuelEnd,
    stints,
    consistency: consistency && {
      score: consistency.score,
      spread_s: consistency.spread,
      clean_laps: consistency.cleanLaps,
      mistake_laps: consistency.mistakeLaps,
      per_stint: consistency.stints.map((x) => ({ stint: x.stint, compound: x.compound, spread_s: x.spread, trend_s_per_lap: x.trend, clean_laps: x.cleanLaps })),
    },
    lap_times_s: laps.map((l) => {
      const t = lapSeconds(l.lap_time);
      return t === null ? null : r3(t);
    }),
    overtakes_made: Array.isArray(story.overtakes_made) ? story.overtakes_made.length : null,
    overtakes_suffered: Array.isArray(story.overtakes_suffered) ? story.overtakes_suffered.length : null,
    fastest_lap_of_race: story.fastest_lap ? { name: story.fastest_lap.name, time: story.fastest_lap.lap_time_str } : null,
    nearby_rivals: nearby,
    final_damage: damage,
    quali,
  };
}

export type DebriefFacts = ReturnType<typeof buildDebriefFacts>;
