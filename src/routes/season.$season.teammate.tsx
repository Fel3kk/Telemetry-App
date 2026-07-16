import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { SUPABASE_URL, SUPABASE_ANON_KEY, titleCaseTrack } from "@/lib/f1-shell";
import { ShellHeader, ShellPage } from "@/components/f1/ShellHeader";

export const Route = createFileRoute("/season/$season/teammate")({
  component: TeammatePage,
});

type FullSession = {
  id: string;
  season: number;
  driver_name?: string;
  track_name: string;
  category: string;
  starting_pos?: number | null;
  finishing_pos?: number | null;
  results?: { name: string; position: any; best_lap?: string }[];
  session_date?: string;
};
type Team = { driver_name: string; team: string };

async function sbFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
  return res.json();
}

const RACE_POINTS = [0, 25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPRINT_POINTS = [0, 8, 7, 6, 5, 4, 3, 2, 1];

function TeammatePage() {
  const { season } = Route.useParams();
  const seasonN = Number(season);
  const [sessions, setSessions] = useState<FullSession[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      sbFetch<FullSession[]>(
        `telemetry_sessions?select=id,season,driver_name,track_name,category,starting_pos,finishing_pos,results,session_date&season=eq.${seasonN}&order=session_date.asc`,
      ),
      sbFetch<Team[]>(`driver_teams?select=driver_name,team&season=eq.${seasonN}`),
    ])
      .then(([s, t]) => {
        if (cancelled) return;
        setSessions(s || []);
        setTeams(t || []);
      })
      .catch((e) => !cancelled && setErr(String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [seasonN]);

  // Count how often each driver name appears in session results (uppercased)
  const appearanceByDriver = useMemo(() => {
    const c: Record<string, number> = {};
    sessions.forEach((s) => {
      (s.results || []).forEach((r) => {
        const n = String(r.name || "").toUpperCase().trim();
        if (!n) return;
        c[n] = (c[n] || 0) + 1;
      });
    });
    return c;
  }, [sessions]);

  // Group drivers by team, pick the 2 who actually race (most appearances)
  const teamGroups = useMemo(() => {
    const g: Record<string, string[]> = {};
    teams.forEach((t) => {
      const team = t.team;
      const name = String(t.driver_name).toUpperCase().trim();
      if (!team || !name) return;
      g[team] = g[team] || [];
      if (!g[team].includes(name)) g[team].push(name);
    });
    return Object.entries(g)
      .filter(([, ds]) => ds.length >= 2)
      .map(([team, ds]) => {
        const sorted = [...ds].sort(
          (x, y) => (appearanceByDriver[y] || 0) - (appearanceByDriver[x] || 0),
        );
        return { team, drivers: sorted.slice(0, 2) as [string, string] };
      })
      .sort((a, b) => a.team.localeCompare(b.team));
  }, [teams, appearanceByDriver]);


  return (
    <>
      <ShellHeader crumbs={[{ label: `Season ${season}`, to: "/" }, { label: "Teammate H2H" }]} />
      <ShellPage>
        <h1 className="mb-2 text-2xl font-black">🤝 Teammate Head-to-Head</h1>
        <p className="mb-6 text-sm text-white/60">
          Every constructor's two drivers compared across the season (Race + Sprint points, Quali/Race/Sprint H2H).
        </p>

        {loading && <div className="text-white/50">Loading season data…</div>}
        {err && <div className="text-red-400">Failed to load: {err}</div>}

        {!loading && teamGroups.length === 0 && (
          <div className="rounded-lg border border-dashed border-white/15 p-8 text-center text-white/60">
            No teams found in <code className="text-white/80">driver_teams</code> for season {season}.
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {teamGroups.map(({ team, drivers }) => (
            <TeamH2H key={team} team={team} drivers={drivers} sessions={sessions} />
          ))}
        </div>

        <div className="mt-6">
          <Link to="/" className="text-sm text-red-400 hover:underline">← Back to season</Link>
        </div>
      </ShellPage>
    </>
  );
}

function TeamH2H({
  team,
  drivers,
  sessions,
}: {
  team: string;
  drivers: [string, string];
  sessions: FullSession[];
}) {
  const [a, b] = drivers;
  const rows = useMemo(() => {
    const perWeekend: Record<string, {
      track: string;
      raceA?: number | null; raceB?: number | null;
      qA?: number | null; qB?: number | null;
      sqA?: number | null; sqB?: number | null;
      sA?: number | null; sB?: number | null;
    }> = {};
    const findPos = (s: FullSession, name: string): number | null => {
      const r = (s.results || []).find(
        (x) => String(x.name || "").toUpperCase().trim() === name,
      );
      if (!r) return null;
      const n = parseInt(String(r.position));
      return Number.isFinite(n) && n > 0 ? n : null;
    };
    sessions.forEach((s) => {
      const track = s.track_name || "?";
      perWeekend[track] = perWeekend[track] || { track };
      const w = perWeekend[track];
      const pa = findPos(s, a);
      const pb = findPos(s, b);
      const cat = (s.category || "").toLowerCase();
      const uploader = String(s.driver_name || "").toUpperCase().trim();
      if (cat === "race") {
        w.raceA = pa; w.raceB = pb;
        // Grid position doubles as quali result — fall back if quali missing
        if (uploader === a && s.starting_pos != null && w.qA == null) w.qA = Number(s.starting_pos);
        if (uploader === b && s.starting_pos != null && w.qB == null) w.qB = Number(s.starting_pos);
      } else if (cat === "sprint") {
        w.sA = pa; w.sB = pb;
        if (uploader === a && s.starting_pos != null && w.sqA == null) w.sqA = Number(s.starting_pos);
        if (uploader === b && s.starting_pos != null && w.sqB == null) w.sqB = Number(s.starting_pos);
      } else if (cat === "sprint shootout" || cat === "sprint qualifying") {
        if (pa != null) w.sqA = pa;
        if (pb != null) w.sqB = pb;
      } else if (cat.includes("quali")) {
        if (pa != null) w.qA = pa;
        if (pb != null) w.qB = pb;
      }
    });
    return Object.values(perWeekend);
  }, [sessions, a, b]);

  const totals = useMemo(() => {
    let raceA = 0, raceB = 0, qA = 0, qB = 0, sqA = 0, sqB = 0, sA = 0, sB = 0, ptsA = 0, ptsB = 0;
    rows.forEach((r) => {
      if (r.raceA && r.raceB) {
        if (r.raceA < r.raceB) raceA++; else if (r.raceA > r.raceB) raceB++;
        ptsA += RACE_POINTS[r.raceA] || 0;
        ptsB += RACE_POINTS[r.raceB] || 0;
      }
      if (r.qA && r.qB) {
        if (r.qA < r.qB) qA++; else if (r.qA > r.qB) qB++;
      }
      if (r.sqA && r.sqB) {
        if (r.sqA < r.sqB) sqA++; else if (r.sqA > r.sqB) sqB++;
      }
      if (r.sA && r.sB) {
        if (r.sA < r.sB) sA++; else if (r.sA > r.sB) sB++;
        ptsA += SPRINT_POINTS[r.sA] || 0;
        ptsB += SPRINT_POINTS[r.sB] || 0;
      }
    });
    return { raceA, raceB, qA, qB, sqA, sqB, sA, sB, ptsA, ptsB };
  }, [rows]);

  const relevantRows = rows.filter(
    (r) => r.raceA || r.raceB || r.qA || r.qB || r.sqA || r.sqB || r.sA || r.sB,
  );
  const aLeads = totals.ptsA >= totals.ptsB;

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-widest text-white/60">{team}</div>
        <div className="text-[10px] text-white/40">{relevantRows.length} weekend{relevantRows.length === 1 ? "" : "s"}</div>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <DriverBlock name={a} pts={totals.ptsA} good={aLeads} />
        <DriverBlock name={b} pts={totals.ptsB} good={!aLeads} />
      </div>
      <div className="mb-3 grid grid-cols-4 gap-2 text-center text-[11px] uppercase tracking-widest text-white/50">
        <div>
          <div>Quali</div>
          <div className="mt-0.5 font-mono text-sm text-white">{totals.qA}–{totals.qB}</div>
        </div>
        <div>
          <div>S.Quali</div>
          <div className="mt-0.5 font-mono text-sm text-white">{totals.sqA}–{totals.sqB}</div>
        </div>
        <div>
          <div>Race</div>
          <div className="mt-0.5 font-mono text-sm text-white">{totals.raceA}–{totals.raceB}</div>
        </div>
        <div>
          <div>Sprint</div>
          <div className="mt-0.5 font-mono text-sm text-white">{totals.sA}–{totals.sB}</div>
        </div>
      </div>
      {relevantRows.length > 0 && (
        <div className="overflow-x-auto rounded border border-white/10">
          <table className="w-full text-xs">
            <thead className="bg-white/5 text-[10px] uppercase tracking-widest text-white/50">
              <tr>
                <th className="p-1.5 text-left">Track</th>
                <th className="p-1.5">Q</th>
                <th className="p-1.5">SQ</th>
                <th className="p-1.5">R</th>
                <th className="p-1.5">S</th>
              </tr>
            </thead>
            <tbody>
              {relevantRows.map((r) => (
                <tr key={r.track} className="border-t border-white/5">
                  <td className="p-1.5 font-semibold">{titleCaseTrack(r.track)}</td>
                  <PairCell x={r.qA} y={r.qB} />
                  <PairCell x={r.sqA} y={r.sqB} />
                  <PairCell x={r.raceA} y={r.raceB} />
                  <PairCell x={r.sA} y={r.sB} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DriverBlock({ name, pts, good }: { name: string; pts: number; good?: boolean }) {
  return (
    <div className={"rounded-md border p-2 " + (good ? "border-emerald-500/40 bg-emerald-500/5" : "border-white/10 bg-white/[0.02]")}>
      <div className="truncate text-sm font-black">{name}</div>
      <div className={"mt-0.5 text-xs font-semibold " + (good ? "text-emerald-400" : "text-white/60")}>{pts} pts</div>
    </div>
  );
}

function PairCell({ x, y }: { x?: number | null; y?: number | null }) {
  if (!x && !y) return <td className="p-1.5 text-center text-white/30">—</td>;
  const xBetter = x && y && x < y;
  const yBetter = x && y && y < x;
  return (
    <td className="p-1.5 text-center font-mono">
      <span className={xBetter ? "text-emerald-400" : yBetter ? "text-red-400" : "text-white/70"}>{x ? `P${x}` : "—"}</span>
      <span className="mx-1 text-white/30">vs</span>
      <span className={yBetter ? "text-emerald-400" : xBetter ? "text-red-400" : "text-white/70"}>{y ? `P${y}` : "—"}</span>
    </td>
  );
}
