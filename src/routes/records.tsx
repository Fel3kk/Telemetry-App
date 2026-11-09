import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  fetchSessions,
  loadCachedSessions,
  titleCaseTrack,
  trackFlag,
  type Session,
} from "@/lib/f1-shell";
import { formatLapMs, personalRecords, sortRecords, type RecordSortKey } from "@/lib/f1-stats";
import { ShellHeader, ShellPage } from "@/components/f1/ShellHeader";

export const Route = createFileRoute("/records")({
  head: () => ({
    meta: [
      { title: "Personal Records · F1 Telemetry Analyzer" },
      { name: "description", content: "Your fastest lap on every track across all seasons." },
      { property: "og:title", content: "Personal Records · F1 Telemetry Analyzer" },
      { property: "og:description", content: "Your fastest lap on every track across all seasons." },
    ],
  }),
  component: RecordsPage,
});

function RecordsPage() {
  const cached = typeof window !== "undefined" ? loadCachedSessions() : null;
  const [sessions, setSessions] = useState<Session[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSessions()
      .then((rows) => { if (!cancelled) setSessions(rows); })
      .catch((e) => { if (!cancelled) setErr(String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const [sortBy, setSortBy] = useState<RecordSortKey>("round");
  const [open, setOpen] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const v = localStorage.getItem(SORT_KEY) as RecordSortKey | null;
      if (v && SORTS.some((o) => o.key === v)) setSortBy(v);
      const raw = localStorage.getItem(OPEN_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) setOpen(new Set(arr.map(String)));
    } catch {
      /* ignore */
    }
  }, []);
  const changeSort = (k: RecordSortKey) => {
    setSortBy(k);
    try { localStorage.setItem(SORT_KEY, k); } catch { /* ignore */ }
  };
  const saveOpen = (next: Set<string>) => {
    setOpen(next);
    try { localStorage.setItem(OPEN_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
  };
  const toggle = (slug: string) => {
    const next = new Set(open);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    saveOpen(next);
  };

  const allRecords = useMemo(() => personalRecords(sessions), [sessions]);
  const records = useMemo(() => sortRecords(allRecords, sortBy), [allRecords, sortBy]);
  const allOpen = records.length > 0 && records.every((r) => open.has(r.slug));
  const totalImprovement = useMemo(
    () => records.reduce((acc, r) => acc + (r.secondBestMs ? r.secondBestMs - r.bestMs : 0), 0),
    [records],
  );

  return (
    <>
      <ShellHeader crumbs={[{ label: "Home", to: "/" }, { label: "Personal Records" }]} />
      <ShellPage>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">⏱️ Personal Records</h1>
            <p className="mt-1 text-sm text-white/50">
              Your fastest lap on every track, across all seasons.
            </p>
          </div>
          <div className="flex gap-2">
            <Stat label="Tracks" value={records.length} />
            <Stat label="Total found" value={`${(totalImprovement / 1000).toFixed(1)}s`} />
          </div>
        </div>

        {records.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => saveOpen(allOpen ? new Set() : new Set(records.map((r) => r.slug)))}
              className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground transition hover:bg-accent"
            >
              {allOpen ? "Collapse all" : "Expand all"}
            </button>
            <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Sort
              <select
                value={sortBy}
                onChange={(e) => changeSort(e.target.value as RecordSortKey)}
                className="rounded-md border border-border bg-background px-2 py-1 text-xs font-semibold normal-case tracking-normal text-foreground"
              >
                {SORTS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </label>
          </div>
        )}

        {loading && <div className="text-white/50">Loading sessions…</div>}
        {err && <div className="text-red-400">Failed to load: {err}</div>}
        {!loading && records.length === 0 && (
          <div className="rounded-lg border border-dashed border-white/15 p-8 text-center text-white/50">
            No laps recorded yet. Upload race or qualifying sessions to build your records wall.
          </div>
        )}

        <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {records.map((r) => {
            const delta = r.secondBestMs ? r.secondBestMs - r.bestMs : null;
            const isOpen = open.has(r.slug);
            return (
              <div
                key={r.slug}
                className={`rounded-lg border bg-white/[0.03] transition-colors duration-300 ${isOpen ? "border-purple-400/40" : "border-white/10 hover:border-purple-400/40"}`}
              >
<<<<<<< HEAD
                <button
                  type="button"
                  onClick={() => toggle(r.slug)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
                >
                  <span className="text-lg leading-none">{trackFlag(r.track)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{titleCaseTrack(r.track)}</span>
                    <span className="flex items-center gap-2 text-[11px]">
                      <span className="font-mono font-black text-purple-300">{formatLapMs(r.bestMs)}</span>
                      {delta != null && delta > 0 && (
                        <span className="font-mono font-semibold text-emerald-400">−{(delta / 1000).toFixed(3)}</span>
                      )}
=======
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-xl">{trackFlag(r.track)}</span>
                    <span className="truncate text-sm font-bold">{titleCaseTrack(r.track)}</span>
                  </div>
                  <span className="shrink-0 rounded-sm border border-white/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white/50">
                    {r.attempts} lap{r.attempts === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="mt-3 font-mono text-2xl font-black tracking-tight text-purple-300">
                  {formatLapMs(r.bestMs)}
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-white/50">
                  <span>
                    Season {r.bestSeason}
                    {r.bestTeam ? ` · ${r.bestTeam}` : ""} · {r.bestCategory}
                  </span>
                  {delta != null && delta > 0 && (
                    <span className="font-semibold text-emerald-400">
                      −{(delta / 1000).toFixed(3)}s vs next best
>>>>>>> 1c6d288d5748ccd014853a524b7ead6ffafd2de5
                    </span>
                  </span>
                  <span className="shrink-0 rounded-sm border border-white/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white/50">
                    {r.attempts}×
                  </span>
                  <span
                    aria-hidden
                    className={`shrink-0 text-xs text-white/50 transition-transform duration-300 ease-out ${isOpen ? "rotate-180" : ""}`}
                  >
                    ▾
                  </span>
                </button>
                <div
                  className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                  aria-hidden={!isOpen}
                  inert={!isOpen}
                >
                  <div className="min-h-0 overflow-hidden">
                  <div className="border-t border-white/10 px-3 pb-3 pt-2">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-1 text-[11px] text-white/50">
                      <span>
                        Season {r.bestSeason}
                        {r.bestTeam ? ` · ${r.bestTeam}` : ""} · {r.bestCategory}
                      </span>
                      <span>
                        {r.attempts} session{r.attempts === 1 ? "" : "s"}
                        {delta != null && delta > 0 ? ` · −${(delta / 1000).toFixed(3)}s vs next best` : ""}
                      </span>
                    </div>
                    <div className="mb-1 text-[10px] uppercase tracking-widest text-white/40">By season</div>
                    <ul className="space-y-1">
                      {r.seasons.map((s) => (
                        <li
                          key={s.season}
                          className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 text-[11px]"
                        >
                          <span className="font-bold text-white/70">S{s.season}</span>
                          <span className="truncate text-white/50">{s.team || "—"}</span>
                          <span className={`font-mono ${s.ms === r.bestMs ? "text-purple-300" : "text-white/80"}`}>
                            {formatLapMs(s.ms)}
                          </span>
                          <span
                            className={`w-14 text-right font-mono ${
                              s.deltaPrevMs == null
                                ? "text-white/30"
                                : s.deltaPrevMs < 0
                                  ? "text-emerald-400"
                                  : "text-red-400"
                            }`}
                          >
                            {s.deltaPrevMs == null
                              ? "—"
                              : `${s.deltaPrevMs < 0 ? "−" : "+"}${(Math.abs(s.deltaPrevMs) / 1000).toFixed(3)}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  </div>
                </div>
                {r.seasons.length > 0 && (
                  <div className="mt-3 border-t border-white/10 pt-2">
                    <div className="mb-1 text-[10px] uppercase tracking-widest text-white/40">
                      By season
                    </div>
                    <ul className="space-y-1">
                      {r.seasons.map((s) => (
                        <li
                          key={s.season}
                          className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 text-[11px]"
                        >
                          <span className="font-bold text-white/70">S{s.season}</span>
                          <span className="truncate text-white/50">{s.team || "—"}</span>
                          <span
                            className={`font-mono ${s.ms === r.bestMs ? "text-purple-300" : "text-white/80"}`}
                          >
                            {formatLapMs(s.ms)}
                          </span>
                          <span
                            className={`w-14 text-right font-mono ${
                              s.deltaPrevMs == null
                                ? "text-white/30"
                                : s.deltaPrevMs < 0
                                  ? "text-emerald-400"
                                  : "text-red-400"
                            }`}
                          >
                            {s.deltaPrevMs == null
                              ? "—"
                              : `${s.deltaPrevMs < 0 ? "−" : "+"}${(Math.abs(s.deltaPrevMs) / 1000).toFixed(3)}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-4">
          <Link to="/" className="text-xs font-semibold text-white/60 hover:text-white">
            ← Back to dashboard
          </Link>
        </div>
      </ShellPage>
    </>
  );
}

const SORT_KEY = "f1.records.sort";
const OPEN_KEY = "f1.records.open";
const SORTS: { key: RecordSortKey; label: string }[] = [
  { key: "round", label: "Round order" },
  { key: "newest", label: "Newest first" },
  { key: "oldest", label: "Oldest first" },
  { key: "best", label: "Biggest gain" },
  { key: "name", label: "Track A–Z" },
];

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-right">
      <div className="text-[10px] uppercase tracking-widest text-white/50">{label}</div>
      <div className="text-lg font-black">{value}</div>
    </div>
  );
}
