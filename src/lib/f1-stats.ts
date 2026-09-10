// Shared season computations for the React shell (title race, records wall).
// Reuses the same classification data the legacy app uses for standings.

import { isRaceResultSession, trackSlug, type Session } from "./f1-shell";

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
  return String(s.race_story?.player_name || s.driver_name || "").toUpperCase();
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
  maxPointsLeft: number; // racesLeft * 26 (win + fastest lap)
};

// Tracks the user has removed from their calendar, persisted locally.
const EXCLUDED_KEY = "f1_excluded_tracks";

export function loadExcludedTracks(): Set<string> {
  try {
    const raw = localStorage.getItem(EXCLUDED_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

export function saveExcludedTracks(excluded: Set<string>) {
  try {
    localStorage.setItem(EXCLUDED_KEY, JSON.stringify(Array.from(excluded)));
  } catch {
    /* ignore */
  }
}

export function computeTitleMath(
  sessions: Session[],
  season: number,
  excluded: Set<string> = new Set(),
): TitleMath {
  const seasonSessions = sessions.filter((s) => Number(s.season) === season);
  const standings = computeStandings(seasonSessions);
  const races = seasonSessions.filter((s) => isRaceResultSession(s) === "Race");
  const racedSlugs = new Set(races.map((s) => trackSlug(s.track_name)));
  const remaining = SEASON_CALENDAR.filter((t) => !racedSlugs.has(t.slug) && !excluded.has(t.slug));
  const playerName = playerNameOf(seasonSessions[seasonSessions.length - 1] ?? ({} as Session));
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
    maxPointsLeft: racesLeft * 26,
  };
}

export type TrackRecord = {
  slug: string;
  track: string;
  bestMs: number;
  bestSeason: number;
  bestCategory: string;
  secondBestMs: number | null;
  attempts: number;
};

// Player's best lap per track across every uploaded season.
export function personalRecords(sessions: Session[]): TrackRecord[] {
  const byTrack = new Map<string, { track: string; laps: { ms: number; season: number; category: string }[] }>();
  for (const s of sessions) {
    const player = playerNameOf(s);
    if (!player) continue;
    const entry = classificationOf(s).find(
      (e: any) => String(e?.name || "").toUpperCase() === player,
    );
    const ms = Number(entry?.best_lap_ms) || 0;
    // Guard against corrupted laps (lapped cars, missing data).
    if (ms < 30000 || ms > 200000) continue;
    const slug = trackSlug(s.track_name);
    if (!slug) continue;
    const bucket = byTrack.get(slug) ?? { track: s.track_name, laps: [] };
    bucket.laps.push({ ms, season: Number(s.season) || 1, category: s.category || "Race" });
    byTrack.set(slug, bucket);
  }
  const out: TrackRecord[] = [];
  for (const [slug, bucket] of byTrack) {
    const sorted = [...bucket.laps].sort((a, b) => a.ms - b.ms);
    const best = sorted[0];
    out.push({
      slug,
      track: bucket.track,
      bestMs: best.ms,
      bestSeason: best.season,
      bestCategory: best.category,
      secondBestMs: sorted.length > 1 ? sorted[1].ms : null,
      attempts: bucket.laps.length,
    });
  }
  return out.sort((a, b) => a.track.localeCompare(b.track));
}

export function formatLapMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const rem = Math.round(ms % 1000);
  return `${m}:${String(s).padStart(2, "0")}.${String(rem).padStart(3, "0")}`;
}
