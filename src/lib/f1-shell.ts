// Client-side helpers for the F1 shell routes.
// Reads sessions directly from the same telemetry_sessions table used by /app/script.js.

export const SUPABASE_URL = "https://kbjjtiajugxvhoboqxwb.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtiamp0aWFqdWd4dmhvYm9xeHdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwODE5NzUsImV4cCI6MjA5MTY1Nzk3NX0.VI2B5EcQXx_aaXyOB-eGXentTbMRG6obxu6IjUv7juI";

export type Session = {
  id: string;
  season: number;
  driver_name?: string;
  track_name: string;
  category: string;
  session_type?: string | null;
  finishing_position: number | null;
  starting_position: number | null;
  created_at: string;
  lap_history?: any[];
  session_info?: any;
  race_story?: any;
};

const SEASON_KEY = "f1.season";

export function getSavedSeason(): number {
  if (typeof window === "undefined") return 1;
  const raw = window.localStorage.getItem(SEASON_KEY);
  const n = raw ? Number(raw) : 1;
  return Number.isFinite(n) && n >= 1 ? n : 1;
}
export function setSavedSeason(n: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SEASON_KEY, String(n));
}

const CACHE_KEY = "f1.sessions.cache.v1";
const CACHE_TTL_MS = 5 * 60 * 1000;

export function loadCachedSessions(): Session[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { t, rows } = JSON.parse(raw);
    if (!Array.isArray(rows)) return null;
    if (Date.now() - Number(t) > CACHE_TTL_MS * 24) return null; // hard TTL 2h
    return rows as Session[];
  } catch { return null; }
}
function saveCachedSessions(rows: Session[]) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), rows })); } catch {}
}
export function cacheIsFresh(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return false;
    const { t } = JSON.parse(raw);
    return Date.now() - Number(t) < CACHE_TTL_MS;
  } catch { return false; }
}

async function currentAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("sb-kbjjtiajugxvhoboqxwb-auth-token");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.access_token ?? parsed?.currentSession?.access_token ?? null;
  } catch { return null; }
}

export async function fetchSessions(season?: number): Promise<Session[]> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/telemetry_sessions`);
  url.searchParams.set("select", "id,season,driver_name,track_name,category,session_type,finishing_pos,starting_pos,created_at,session_date,race_story");
  url.searchParams.set("order", "session_date.desc");
  if (season != null) url.searchParams.set("season", `eq.${season}`);
  const token = await currentAccessToken();
  const res = await fetch(url.toString(), {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Failed to load telemetry sessions (${res.status})`);
  const rows = await res.json();
  const mapped = rows.map(mapTelemetrySession);
  if (season == null && token) saveCachedSessions(mapped);
  return mapped;
}

export function titleCaseTrack(name: string) {
  return (name || "")
    .split(/([\s_-]+)/)
    .map((p) => (/^[\s_-]+$/.test(p) ? " " : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()))
    .join("")
    .trim();
}

function mapTelemetrySession(row: any): Session {
  return {
    ...row,
    season: Number(row.season ?? 1),
    driver_name: row.driver_name,
    track_name: row.track_name,
    category: row.category || "Race",
    session_type: row.session_type ?? null,
    finishing_position: row.finishing_position ?? row.finishing_pos ?? null,
    starting_position: row.starting_position ?? row.starting_pos ?? null,
    created_at: row.created_at ?? row.session_date ?? "",
    lap_history: row.lap_history || [],
    session_info: row.session_info || null,
    race_story: row.race_story || null,
  };
}

const TRACK_SLUG_ALIASES: Record<string, string> = {
  "las_vegas": "vegas",
  "lasvegas": "vegas",
  "yas_marina": "abu_dhabi",
  "abu": "abu_dhabi",
  "mexico_city": "mexico",
  "interlagos": "brazil",
  "são_paulo": "brazil",
  "sao_paulo": "brazil",
  "qatar": "losail",
  "austin": "texas",
};
export function trackSlug(name: string) {
  const base = (name || "").toLowerCase().trim().replace(/\s+/g, "_");
  return TRACK_SLUG_ALIASES[base] || base;
}

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "") + "/";

export function trackMapUrl(name: string) {
  return `${BASE}track-maps/${trackSlug(name)}.webp`;
}
export function trackMapFallbackUrl(name: string) {
  return `${BASE}track-maps/${trackSlug(name)}.png`;
}
export function appEmbedUrl(params: { season: number; track: string; view: string; cat?: string }) {
  const qp = new URLSearchParams();
  qp.set("season", String(params.season));
  qp.set("track", params.track);
  qp.set("view", params.view);
  if (params.cat) qp.set("cat", params.cat);
  return `${BASE}app/index.html?${qp.toString()}`;
}
export function appManageUrl() {
  return `${BASE}app/index.html`;
}

const TRACK_FLAGS: Record<string, string> = {
  melbourne: "🇦🇺", shanghai: "🇨🇳", suzuka: "🇯🇵", sakhir: "🇧🇭",
  jeddah: "🇸🇦", miami: "🇺🇸", imola: "🇮🇹", monaco: "🇲🇨",
  catalunya: "🇪🇸", montreal: "🇨🇦", austria: "🇦🇹", silverstone: "🇬🇧",
  spa: "🇧🇪", hungaroring: "🇭🇺", zandvoort: "🇳🇱", monza: "🇮🇹",
  madrid: "🇪🇸", baku: "🇦🇿", singapore: "🇸🇬", texas: "🇺🇸",
  austin: "🇺🇸", mexico: "🇲🇽", mexico_city: "🇲🇽", interlagos: "🇧🇷",
  brazil: "🇧🇷", las_vegas: "🇺🇸", lasvegas: "🇺🇸", "las vegas": "🇺🇸",
  vegas: "🇺🇸", losail: "🇶🇦", qatar: "🇶🇦", abu_dhabi: "🇦🇪",
  yas_marina: "🇦🇪", abu: "🇦🇪", "abu dhabi": "🇦🇪",
};
export function trackFlag(name: string) {
  return TRACK_FLAGS[trackSlug(name)] || "🏁";
}

export type SessionBadges = { win?: boolean; pole?: boolean; fl?: boolean; podium?: boolean; gs?: boolean };
export function badgesFor(s: Session): SessionBadges {
  const finish = Number(s.finishing_position);
  const start = Number(s.starting_position);
  return {
    win: finish === 1,
    pole: start === 1,
    podium: finish >= 1 && finish <= 3,
    fl: !!(s.race_story?.player_fastest_lap ?? false),
    gs: !!(s.race_story?.grand_slam ?? false),
  };
}

export function seasonStats(sessions: Session[]) {
  const races = sessions.filter((s) => s.category === "Race");
  const sprints = sessions.filter((s) => s.category === "Sprint");
  return {
    raceWins: races.filter((s) => Number(s.finishing_position) === 1).length,
    sprintWins: sprints.filter((s) => Number(s.finishing_position) === 1).length,
    gpPoles: races.filter((s) => Number(s.starting_position) === 1).length,
    sprintPoles: sprints.filter((s) => Number(s.starting_position) === 1).length,
    podiums: races.filter((s) => {
      const p = Number(s.finishing_position);
      return p >= 1 && p <= 3;
    }).length,
    fastestLaps: sessions.filter((s) => badgesFor(s).fl).length,
  };
}

// Group by track + category. Practice sessions fold into the Race weekend
// (and are also mirrored into any Sprint bucket for that track).
export function groupByTrack(sessions: Session[]) {
  const map = new Map<string, { track: string; category: string; sessions: Session[] }>();
  const tracksWithSprint = new Set<string>();
  for (const s of sessions) {
    const cat = s.category || "Race";
    if (cat === "Sprint" || cat === "Sprint Qualifying" || cat === "Sprint Shootout") {
      tracksWithSprint.add(trackSlug(s.track_name));
    }
  }
  for (const s of sessions) {
    const track = trackSlug(s.track_name);
    if (!track) continue;
    const cat = s.category || "Race";
    const buckets: string[] =
      cat === "Sprint" || cat === "Sprint Qualifying" || cat === "Sprint Shootout"
        ? ["Sprint"]
        : cat === "Practice"
        ? tracksWithSprint.has(track) ? ["Race", "Sprint"] : ["Race"]
        : ["Race"];
    for (const bucket of buckets) {
      const key = `${track}::${bucket}`;
      const entry = map.get(key) ?? { track: s.track_name, category: bucket, sessions: [] };
      entry.sessions.push(s);
      map.set(key, entry);
    }
  }
  return Array.from(map.values());
}
