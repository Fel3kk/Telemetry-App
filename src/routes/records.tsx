import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  fetchSessions,
  loadCachedSessions,
  titleCaseTrack,
  trackFlag,
  type Session,
} from "@/lib/f1-shell";
import { computeTitleMath, formatLapMs, personalRecords } from "@/lib/f1-stats";
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

  const records = useMemo(() => personalRecords(sessions), [sessions]);
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

        {loading && <div className="text-white/50">Loading sessions…</div>}
        {err && <div className="text-red-400">Failed to load: {err}</div>}
        {!loading && records.length === 0 && (
          <div className="rounded-lg border border-dashed border-white/15 p-8 text-center text-white/50">
            No laps recorded yet. Upload race or qualifying sessions to build your records wall.
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {records.map((r) => {
            const delta = r.secondBestMs ? r.secondBestMs - r.bestMs : null;
            return (
              <div
                key={r.slug}
                className="group rounded-lg border border-white/10 bg-white/[0.03] p-4 transition hover:-translate-y-0.5 hover:border-purple-400/50"
              >
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
                    Season {r.bestSeason} · {r.bestCategory}
                  </span>
                  {delta != null && delta > 0 && (
                    <span className="font-semibold text-emerald-400">
                      −{(delta / 1000).toFixed(3)}s vs next best
                    </span>
                  )}
                </div>
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

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-right">
      <div className="text-[10px] uppercase tracking-widest text-white/50">{label}</div>
      <div className="text-lg font-black">{value}</div>
    </div>
  );
}
