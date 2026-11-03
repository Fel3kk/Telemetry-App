// Shared season computations for the React shell (title race, records wall).
// Reuses the same classification data the legacy app uses for standings.

import { badgesFor, isRaceResultSession, racePosition, roundOrder, trackSlug, type Session } from "./f1-shell";

export const RACE_POINTS = [0, 25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
export const SPRINT_POINTS = [0, 8, 7, 6, 5, 4, 3, 2, 1];

// F1 26 game Grand Prix calendar (slugs matching trackSlug()).
export const SEASON_CALENDAR: { slug: string; name: string }[] = [
  { slug: "melbourne", name: "Australia" },
  { slug: "shanghai", name: "China" },
  { slug: "suzuka", name: "Japan" },
  { slug: "sakhir", name: "Bahrain" },
  { slug: "jeddah", name: "Saudi Arabia" },
  { slug: "miami", name: "Miami" },
  { slug: "montreal", name: "Canada" },
  { slug: "monaco", name: "Monaco" },
  { slug: "catalunya", name: "Spain" },
  { slug: "austria_reverse", name: "Austria (Reverse)" },
  { slug: "austria", name: "Austria" },
  { slug: "silverstone_reverse", name: "Britain (Reverse)" },
  { slug: "silverstone", name: "Britain" },
  { slug: "spa", name: "Belgium" },
  { slug: "hungaroring", name: "Hungary" },
  { slug: "zandvoort_reverse", name: "Netherlands (Reverse)" },
  { slug: "zandvoort", name: "Netherlands" },
  { slug: "monza", name: "Italy" },
  { slug: "madrid", name: "Madrid" },
  { slug: "baku", name: "Azerbaijan" },
  { slug: "singapore", name: "Singapore" },
  { slug: "texas", name: "USA" },
  { slug: "mexico", name: "Mexico" },
  { slug: "brazil", name: "Brazil" },
  { slug: "vegas", name: "Las Vegas" },
  { slug: "losail", name: "Qatar" },
  { slug: "abu_dhabi", name: "Abu Dhabi" },
];

export function playerNameOf(s: Session): string {
  const direct = String(s?.race_story?.player_name || s?.driver_name || "").trim().toUpperCase();
  if (direct) return direct;
  const flagged = (Array.isArray(s?.race_story?.classification) ? s.race_story.classification : []).find(
    (e: any) => e?.is_player === true || e?.["is-player"] === true,
  );
  return String(flagged?.name || "").trim().toUpperCase();
}

// The player's name for a whole season: the most common name across the
// season's race results (falls back to any session). One odd session (e.g. a
// practice file with no driver name) can no longer hide you from the standings.
export function seasonPlayerName(sessions: Session[]): string {
  const votes = new Map<string, number>();
  const tally = (list: Session[]) => {
    for (const s of list) {
      const n = playerNameOf(s);
      if (n) votes.set(n, (votes.get(n) ?? 0) + 1);
    }
  };
  tally(sessions.filter((s) => isRaceResultSession(s)));
  if (votes.size === 0) tally(sessions);
  let best = "";
  let bestN = 0;
  for (const [n, c] of votes) if (c > bestN) { best = n; bestN = c; }
  return best;
}

function classificationOf(s: Session): any[] {
  return Array.isArray(s.race_story?.classification) ? s.race_story.classification : [];
}

function entryIsDnf(e: any): boolean {
  const status = String(e?.status || "").toUpperCase();
  return e?.is_dnf === true || (status.length > 0 && !/FINISHED|ACTIVE/.test(status));
}

export type DriverStanding = {
  name: string;
  team: string;
  points: number;
  wins: number;
  podiums: number;
  dnfs: number;
};

// Championship standings for one season, scored from each race/sprint
// classification (same points tables as the legacy standings view).
export function computeStandings(sessions: Session[]): DriverStanding[] {
  const map = new Map<string, DriverStanding>();
  const scoring = sessions
    .filter((s) => isRaceResultSession(s))
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  for (const s of scoring) {
    const kind = isRaceResultSession(s);
    const table = kind === "Sprint" ? SPRINT_POINTS : RACE_POINTS;
    for (const e of classificationOf(s)) {
      const name = String(e?.name || "").toUpperCase();
      if (!name) continue;
      const d = map.get(name) ?? { name, team: String(e?.team || ""), points: 0, wins: 0, podiums: 0, dnfs: 0 };
      if (e?.team) d.team = String(e.team);
      const dnf = entryIsDnf(e);
      const pos = Number(e?.position) || 0;
      if (dnf) {
        d.dnfs += 1;
      } else if (pos > 0) {
        d.points += table[pos] || 0;
        if (pos === 1) d.wins += 1;
        if (pos <= 3) d.podiums += 1;
      }
      map.set(name, d);
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name),
  );
}

export type TitleMath = {
  standings: DriverStanding[];
  playerName: string;
  player: DriverStanding | null;
  leader: DriverStanding | null;
  racedSlugs: Set<string>;
  remaining: { slug: string; name: string }[];
  racesLeft: number;
  maxPointsLeft: number; // racesLeft * 25 (race win) + sprints left * 8
};

// Tracks the user has removed from their calendar, persisted locally.
const EXCLUDED_KEY = "f1_excluded_tracks";
const seasonKey = (season: number) => `${EXCLUDED_KEY}_s${season}`;

export function loadExcludedTracks(season?: number): Set<string> {
  try {
    if (season == null) {
      const raw = localStorage.getItem(EXCLUDED_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr.map(String) : []);
    }
    const raw = localStorage.getItem(seasonKey(season));
    if (raw == null) {
      // First time for this season: seed from the old global list (one-off migration).
      const legacy = localStorage.getItem(EXCLUDED_KEY);
      const arr = legacy ? JSON.parse(legacy) : [];
      const set = new Set<string>(Array.isArray(arr) ? arr.map(String) : []);
      saveExcludedTracks(set, season);
      return set;
    }
    const arr = JSON.parse(raw);
    return new Set<string>(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

export function saveExcludedTracks(excluded: Set<string>, season?: number) {
  try {
    localStorage.setItem(
      season == null ? EXCLUDED_KEY : seasonKey(season),
      JSON.stringify(Array.from(excluded)),
    );
  } catch {
    /* ignore */
  }
}

// Max points one driver can still take per weekend type.
export const GP_MAX_POINTS = RACE_POINTS[1]; // race win (no fastest-lap point)
export const SPRINT_MAX_POINTS = SPRINT_POINTS[1]; // sprint win

// Real 2026 sprint weekends — used as the starting list for a new season.
export const DEFAULT_SPRINT_WEEKENDS = ["shanghai", "miami", "montreal", "silverstone", "zandvoort", "singapore"];

function loadSlugSet(key: string, fallback: string[]): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return new Set(fallback);
    const arr = JSON.parse(raw);
    return new Set<string>(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set(fallback);
  }
}
function saveSlugSet(key: string, set: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {
    /* ignore */
  }
}

// Which weekends of a season have a sprint, saved per season on this device.
export const loadSprintWeekends = (season: number) =>
  loadSlugSet(`f1_sprint_weekends_s${season}`, DEFAULT_SPRINT_WEEKENDS);
export const saveSprintWeekends = (set: Set<string>, season: number) =>
  saveSlugSet(`f1_sprint_weekends_s${season}`, set);

// Modded / extra tracks the user added to a season's calendar.
export const loadExtraTracks = (season: number) => loadSlugSet(`f1_extra_tracks_s${season}`, []);
export const saveExtraTracks = (set: Set<string>, season: number) =>
  saveSlugSet(`f1_extra_tracks_s${season}`, set);

export type CalendarRound = {
  slug: string;
  name: string;
  done: boolean; // Grand Prix result uploaded
  sprint: boolean; // sprint weekend
  sprintDone: boolean;
  round: number | null; // order driven (first session date), null if not driven yet
};

function prettyTrack(name: string): string {
  return String(name || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export type TitleOptions = {
  excluded?: Set<string>;
  sprints?: Set<string>;
  extras?: Set<string>;
  extraNames?: Record<string, string>;
};

export function computeTitleMath(
  sessions: Session[],
  season: number,
  excludedOrOpts: Set<string> | TitleOptions = new Set(),
): TitleMath & { rounds: CalendarRound[]; sprintsLeft: number } {
  const opts: TitleOptions = excludedOrOpts instanceof Set ? { excluded: excludedOrOpts } : excludedOrOpts;
  const excluded = opts.excluded ?? new Set<string>();
  const sprints = opts.sprints ?? new Set<string>();
  const extras = opts.extras ?? new Set<string>();
  const seasonSessions = sessions.filter((s) => Number(s.season) === season);
  const standings = computeStandings(seasonSessions);
  const races = seasonSessions.filter((s) => isRaceResultSession(s) === "Race");
  const sprintRaces = seasonSessions.filter((s) => isRaceResultSession(s) === "Sprint");
  const racedSlugs = new Set(races.map((s) => trackSlug(s.track_name)));
  const sprintedSlugs = new Set(sprintRaces.map((s) => trackSlug(s.track_name)));
  const order = roundOrder(seasonSessions);

  // Calendar = official tracks + user-added extras + any track already driven
  // (mods appear automatically). Driven rounds come first, in the order they
  // were driven; the rest keep calendar order.
  const names = new Map<string, string>(SEASON_CALENDAR.map((t) => [t.slug, t.name]));
  for (const slug of extras) if (!names.has(slug)) names.set(slug, opts.extraNames?.[slug] ?? prettyTrack(slug));
  for (const s of seasonSessions) {
    const slug = trackSlug(s.track_name);
    if (slug && !names.has(slug)) names.set(slug, opts.extraNames?.[slug] ?? prettyTrack(s.track_name));
  }
  const calIndex = (slug: string) => {
    const i = SEASON_CALENDAR.findIndex((t) => t.slug === slug);
    return i === -1 ? 1000 : i;
  };
  const rounds: CalendarRound[] = [...names.entries()]
    .map(([slug, name]) => ({
      slug,
      name,
      done: racedSlugs.has(slug),
      sprint: sprints.has(slug) || sprintedSlugs.has(slug),
      sprintDone: sprintedSlugs.has(slug),
      round: order.get(slug) ?? null,
    }))
    .sort((a, b) => {
      if (a.round != null && b.round != null) return a.round - b.round;
      if (a.round != null) return -1;
      if (b.round != null) return 1;
      return calIndex(a.slug) - calIndex(b.slug) || a.name.localeCompare(b.name);
    });

  const remaining = rounds
    .filter((r) => !r.done && !excluded.has(r.slug))
    .map((r) => ({ slug: r.slug, name: r.name }));
  const sprintsLeft = rounds.filter(
    (r) => r.sprint && !r.sprintDone && !r.done && !excluded.has(r.slug),
  ).length;
  const playerName = seasonPlayerName(seasonSessions);
  const player = standings.find((d) => d.name === playerName) ?? null;
  const leader = standings[0] ?? null;
  const racesLeft = remaining.length;
  return {
    standings,
    playerName,
    player,
    leader,
    racedSlugs,
    remaining,
    racesLeft,
    sprintsLeft,
    rounds,
    maxPointsLeft: racesLeft * GP_MAX_POINTS + sprintsLeft * SPRINT_MAX_POINTS,
  };
}

// ---------------------------------------------------------------
// Season summary (share card)
// ---------------------------------------------------------------
export type SeasonSummary = {
  season: number;
  championshipPos: number | null;
  totalPoints: number;
  avgPoints: number | null; // per race start (GP + sprint)
  starts: number; // GP + sprint starts
  gpStarts: number;
  sprintStarts: number;
  wins: number;
  sprintWins: number;
  podiums: number;
  pointsFinishes: number;
  poles: number;
  sprintPoles: number;
  fastestLaps: number;
  dnfs: number;
  finishRate: number | null; // % of starts finished
  avgFinish: number | null;
  avgGrid: number | null;
  bestFinish: number | null;
  positionsGained: number; // net, finished races only
  lapsCompleted: number;
  q1Apps: number; // GP weekends with qualifying uploaded
  q2Apps: number; // reached Q2 (includes Q3)
  q3Apps: number; // reached Q3
  avgQuali: number | null;
};

// 1-3 for Q1/Q2/Q3 ("Qualifying 2", "Q2", …); 4 for one-session formats.
export function qualiStage(s: Pick<Session, "session_type">): number {
  const st = String(s.session_type || "").toLowerCase().replace(/\s+/g, "");
  const m = st.match(/^(?:q|qualifying)([123])$/);
  return m ? Number(m[1]) : 4;
}
function isGpQuali(s: Session): boolean {
  const txt = `${s.category} ${s.session_type ?? ""}`.toLowerCase();
  return /quali/.test(txt) && !/sprint|shootout/.test(txt);
}
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function seasonSummary(sessions: Session[], season: number): SeasonSummary {
  const seasonSessions = sessions.filter((s) => Number(s.season) === season);
  const standings = computeStandings(seasonSessions);
  const scoring = seasonSessions.filter((s) => isRaceResultSession(s));
  const playerName = seasonPlayerName(seasonSessions);
  const standingIdx = standings.findIndex((d) => d.name === playerName);

  let wins = 0, sprintWins = 0, podiums = 0, pointsFinishes = 0, poles = 0, sprintPoles = 0;
  let fastestLaps = 0, dnfs = 0, gpStarts = 0, sprintStarts = 0, positionsGained = 0, laps = 0;
  const finishes: number[] = [];
  const grids: number[] = [];
  for (const s of scoring) {
    const kind = isRaceResultSession(s);
    const b = badgesFor(s);
    if (kind === "Sprint") sprintStarts += 1;
    else gpStarts += 1;
    if (b.win) kind === "Sprint" ? sprintWins++ : wins++;
    if (b.pole) kind === "Sprint" ? sprintPoles++ : poles++;
    if (b.podium) podiums += 1;
    if (b.fl) fastestLaps += 1;
    const me = classificationOf(s).find((e: any) => String(e?.name || "").toUpperCase() === playerNameOf(s));
    laps += Number(me?.laps) || 0;
    const gridEntry = Array.isArray(s.race_story?.starting_grid)
      ? s.race_story.starting_grid.find((e: any) => String(e?.name || "").toUpperCase() === playerNameOf(s))
      : null;
    const grid = Number(gridEntry?.position || s.starting_position) || 0;
    if (kind === "Race" && grid > 0) grids.push(grid);
    if (b.dnf) {
      dnfs += 1;
      continue;
    }
    const fin = racePosition(s);
    if (!fin) continue;
    finishes.push(fin);
    if (fin <= (kind === "Sprint" ? 8 : 10)) pointsFinishes += 1;
    if (grid > 0) positionsGained += grid - fin;
  }

  // Furthest qualifying stage per GP weekend, from the deepest session uploaded.
  const byTrack = new Map<string, Session[]>();
  for (const s of seasonSessions.filter(isGpQuali)) {
    const slug = trackSlug(s.track_name);
    byTrack.set(slug, [...(byTrack.get(slug) ?? []), s]);
  }
  // Appearances are cumulative: reaching Q3 also counts as a Q2 and Q1 appearance.
  let q1Apps = 0, q2Apps = 0, q3Apps = 0;
  const qualiPositions: number[] = [];
  for (const list of byTrack.values()) {
    const pos = (stage: number) => Number(list.find((s) => qualiStage(s) === stage)?.finishing_position) || 0;
    const p1 = pos(1), p2 = pos(2), p3 = pos(3), single = pos(4);
    const final = p3 || p2 || p1 || single;
    if (final > 0) qualiPositions.push(final);
    const reachedQ3 = p3 > 0 || (p2 > 0 && p2 <= 10) || (single > 0 && single <= 10);
    const reachedQ2 = reachedQ3 || p2 > 0 || (p1 > 0 && p1 <= 16) || (single > 0 && single <= 16);
    q1Apps += 1;
    if (reachedQ2) q2Apps += 1;
    if (reachedQ3) q3Apps += 1;
  }

  const starts = gpStarts + sprintStarts;
  const totalPoints = standingIdx >= 0 ? standings[standingIdx].points : 0;
  return {
    season,
    championshipPos: standingIdx >= 0 ? standingIdx + 1 : null,
    totalPoints,
    avgPoints: starts ? totalPoints / starts : null,
    starts,
    gpStarts,
    sprintStarts,
    wins,
    sprintWins,
    podiums,
    pointsFinishes,
    poles,
    sprintPoles,
    fastestLaps,
    dnfs,
    finishRate: starts ? ((starts - dnfs) / starts) * 100 : null,
    avgFinish: avg(finishes),
    avgGrid: avg(grids),
    bestFinish: finishes.length ? Math.min(...finishes) : null,
    positionsGained,
    lapsCompleted: laps,
    q1Apps,
    q2Apps,
    q3Apps,
    avgQuali: avg(qualiPositions),
  };
}

export type SeasonBest = {
  season: number;
  team: string;
  ms: number;
  category: string;
  deltaPrevMs: number | null; // vs previous season best (negative = faster)
};

export type TrackRecord = {
  slug: string;
  track: string;
  bestMs: number;
  bestSeason: number;
  bestTeam: string;
  bestCategory: string;
  secondBestMs: number | null;
  attempts: number;
  seasons: SeasonBest[];
  firstAt: number; // earliest session upload time (ms epoch)
  lastAt: number; // latest session upload time (ms epoch)
};

function cleanTeam(t: unknown): string {
  const s = String(t || "").trim().replace(/\s+(19|20)?\d{2}$/, "");
  return s ? s.replace(/\b\w/g, (c) => c.toUpperCase()) : "";
}

// Player's best lap per track across every uploaded season, with per-season bests.
export function personalRecords(sessions: Session[]): TrackRecord[] {
  type Lap = { ms: number; season: number; category: string; team: string; at: number };
  const byTrack = new Map<string, { track: string; laps: Lap[] }>();
  for (const s of sessions) {
    const player = playerNameOf(s);
    if (!player) continue;
    const entry = classificationOf(s).find(
      (e: any) => String(e?.name || "").toUpperCase() === player,
    );
    const ms = Number(entry?.best_lap_ms) || 0;
    if (ms < 30000 || ms > 200000) continue;
    const slug = trackSlug(s.track_name);
    if (!slug) continue;
    const team = cleanTeam(entry?.team || (s as any).race_story?.player_team || (s as any).team);
    const bucket = byTrack.get(slug) ?? { track: s.track_name, laps: [] };
    bucket.laps.push({ ms, season: Number(s.season) || 1, category: s.category || "Race", team, at: Date.parse(s.created_at || "") || 0 });
    byTrack.set(slug, bucket);
  }
  const out: TrackRecord[] = [];
  for (const [slug, bucket] of byTrack) {
    const sorted = [...bucket.laps].sort((a, b) => a.ms - b.ms);
    const best = sorted[0];
    const perSeason = new Map<number, Lap>();
    for (const l of bucket.laps) {
      const cur = perSeason.get(l.season);
      if (!cur || l.ms < cur.ms) perSeason.set(l.season, l);
    }
    const seasons: SeasonBest[] = [];
    let prev: number | null = null;
    for (const l of [...perSeason.values()].sort((a, b) => a.season - b.season)) {
      seasons.push({
        season: l.season,
        team: l.team,
        ms: l.ms,
        category: l.category,
        deltaPrevMs: prev == null ? null : l.ms - prev,
      });
      prev = l.ms;
    }
    out.push({
      slug,
      track: bucket.track,
      bestMs: best.ms,
      bestSeason: best.season,
      bestTeam: best.team,
      bestCategory: best.category,
      secondBestMs: sorted.length > 1 ? sorted[1].ms : null,
      attempts: bucket.laps.length,
      seasons,
      firstAt: Math.min(...bucket.laps.map((l) => l.at)),
      lastAt: Math.max(...bucket.laps.map((l) => l.at)),
    });
  }
  return out.sort((a, b) => a.track.localeCompare(b.track));
}

export type RecordSortKey = "round" | "newest" | "oldest" | "best" | "name";

// Order records like the home page: calendar order first (modded tracks after,
// in the order they were first driven), or by upload time / improvement / name.
export function sortRecords(records: TrackRecord[], key: RecordSortKey): TrackRecord[] {
  const cal = (slug: string) => {
    const i = SEASON_CALENDAR.findIndex((t) => t.slug === slug);
    return i === -1 ? 1000 : i;
  };
  const byRound = (a: TrackRecord, b: TrackRecord) =>
    cal(a.slug) - cal(b.slug) || a.firstAt - b.firstAt || a.track.localeCompare(b.track);
  const gain = (r: TrackRecord) => (r.secondBestMs ? r.secondBestMs - r.bestMs : -1);
  const cmp: Record<RecordSortKey, (a: TrackRecord, b: TrackRecord) => number> = {
    round: byRound,
    newest: (a, b) => b.lastAt - a.lastAt || byRound(a, b),
    oldest: (a, b) => a.firstAt - b.firstAt || byRound(a, b),
    best: (a, b) => gain(b) - gain(a) || byRound(a, b),
    name: (a, b) => titleSort(a.track).localeCompare(titleSort(b.track)) || byRound(a, b),
  };
  return [...records].sort(cmp[key]);
}
const titleSort = (t: string) => String(t || "").toLowerCase();

export function formatLapMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const rem = Math.round(ms % 1000);
  return `${m}:${String(s).padStart(2, "0")}.${String(rem).padStart(3, "0")}`;
}
