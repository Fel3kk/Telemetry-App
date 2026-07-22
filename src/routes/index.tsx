import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  fetchSessions,
  loadCachedSessions,
  cacheIsFresh,
  getSavedSeason,
  setSavedSeason,
  groupByTrack,
  seasonStats,
  trackFlag,
  trackMapUrl,
  trackMapFallbackUrl,
  trackSlug,
  titleCaseTrack,
  badgesFor,
  appEmbedUrl,
  type Session,
} from "@/lib/f1-shell";
import { ShellHeader, ShellPage } from "@/components/f1/ShellHeader";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "F1 Telemetry Analyzer" },
      { name: "description", content: "Season standings, race stories, and telemetry from your F1 uploads." },
      { property: "og:title", content: "F1 Telemetry Analyzer" },
      { property: "og:description", content: "Season standings, race stories, and telemetry from your F1 uploads." },
    ],
  }),
  component: MainPage,
});

const SEASONS = Array.from({ length: 10 }, (_, i) => i + 1);

function MainPage() {
  const [season, setSeason] = useState<number>(1);
  const cached = typeof window !== "undefined" ? loadCachedSessions() : null;
  const [sessions, setSessions] = useState<Session[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { setSeason(getSavedSeason()); }, []);

  useEffect(() => {
    let cancelled = false;
    if (cacheIsFresh() && cached) { setLoading(false); return; }
    setLoading(sessions.length === 0);
    fetchSessions()
      .then((rows) => { if (!cancelled) setSessions(rows); })
      .catch((e) => { if (!cancelled) setErr(String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seasonSessions = useMemo(
    () => sessions.filter((s) => Number(s.season) === season),
    [sessions, season],
  );
  const stats = useMemo(() => seasonStats(seasonSessions), [seasonSessions]);
  const trackGroups = useMemo(() => groupByTrack(seasonSessions), [seasonSessions]);

  const pick = (n: number) => { setSeason(n); setSavedSeason(n); };

  return (
    <>
      <ShellHeader crumbs={[{ label: `Season ${season}` }]} />
      <ShellPage>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-widest text-white/50">Season</span>
          {SEASONS.map((n) => (
            <button
              key={n}
              onClick={() => pick(n)}
              className={
                "rounded-md border px-3 py-1.5 text-sm font-semibold transition " +
                (season === n
                  ? "border-red-500 bg-red-500 text-white"
                  : "border-white/15 text-white/70 hover:border-white/40")
              }
            >
              S{n}
            </button>
          ))}
        </div>

        <UploadPanel season={season} />

        <StatsBar stats={stats} />

        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest text-white/60">
            Tracks · Season {season}
          </h2>
        </div>

        {loading && <div className="text-white/50">Loading sessions…</div>}
        {err && <div className="text-red-400">Failed to load: {err}</div>}
        {!loading && trackGroups.length === 0 && (
          <div className="rounded-lg border border-dashed border-white/15 p-8 text-center text-white/50">
            No sessions uploaded for Season {season} yet. Use the upload panel above to add telemetry JSON.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {trackGroups.map((g) => (
            <TrackCard
              key={`${trackSlug(g.track)}::${g.category}`}
              season={season}
              track={g.track}
              category={g.category}
              sessions={g.sessions}
            />
          ))}
        </div>
      </ShellPage>
    </>
  );
}

function UploadPanel({ season }: { season: number }) {
  const src = appEmbedUrl({ season, track: "", view: "upload" });
  return (
    <div className="mb-6 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-widest text-white/60">Upload sessions</div>
        <div className="text-[10px] text-white/40">Race · Qualifying · Practice · batch</div>
      </div>
      <iframe
        title="Upload sessions"
        src={src}
        loading="lazy"
        className="w-full rounded border-0 bg-transparent"
        style={{ height: 120 }}
      />
    </div>
  );
}

function StatsBar({ stats }: { stats: ReturnType<typeof seasonStats> }) {
  const items = [
    { label: "GP Wins", value: stats.raceWins, icon: "🏆" },
    { label: "Sprint Wins", value: stats.sprintWins, icon: "🏁" },
    { label: "GP Poles", value: stats.gpPoles, icon: "⏱️" },
    { label: "Sprint Poles", value: stats.sprintPoles, icon: "⚡" },
    { label: "Podiums", value: stats.podiums, icon: "🥂" },
    { label: "Fastest Laps", value: stats.fastestLaps, icon: "💜" },
  ];
  return (
    <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((it) => (
        <div key={it.label} className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-3">
          <div className="text-[10px] uppercase tracking-widest text-white/50">{it.label}</div>
          <div className="mt-1 text-xl font-black">{it.icon} {it.value}</div>
        </div>
      ))}
    </div>
  );
}

function TrackCard({ season, track, category, sessions }: { season: number; track: string; category: string; sessions: Session[] }) {
  const badgeAgg: Record<string, boolean> = {};
  sessions.forEach((s) => {
    const b = badgesFor(s);
    Object.entries(b).forEach(([k, v]) => { if (v) badgeAgg[k] = true; });
  });
  const [imgSrc, setImgSrc] = useState(trackMapUrl(track));
  const [imgOk, setImgOk] = useState(true);
  const triedFallback = useMemo(() => ({ v: false }), [track]);
  const display = titleCaseTrack(track);
  const catColor = category === "Sprint" ? "#f59e0b" : category === "Practice" ? "#64748b" : "#ef4444";
  return (
    <Link
      to="/season/$season/track/$track"
      params={{ season: String(season), track: trackSlug(track) }}
      search={{ cat: category }}
      className="group flex flex-col overflow-hidden rounded-lg border border-white/10 bg-white/[0.03] transition hover:-translate-y-0.5 hover:border-red-500/60"
    >
      <div className="relative aspect-[16/9] bg-black/40">
        {imgOk ? (
          <img
            src={imgSrc}
            alt={display}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain p-3"
            onError={() => {
              if (!triedFallback.v) { triedFallback.v = true; setImgSrc(trackMapFallbackUrl(track)); }
              else setImgOk(false);
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl opacity-40">{trackFlag(track)}</div>
        )}
        <div className="absolute right-2 top-2 flex flex-wrap gap-1">
          {badgeAgg.gs && <Tag color="#c084fc">GS</Tag>}
          {badgeAgg.win && <Tag color="#ffd700">W</Tag>}
          {badgeAgg.pole && <Tag color="#5ad1ff">P</Tag>}
          {badgeAgg.fl && <Tag color="#a855f7">FL</Tag>}
          {!badgeAgg.win && badgeAgg.podium && <Tag color="#cd7f32">P3</Tag>}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{trackFlag(track)}</span>
          <span className="truncate text-base font-bold">{display}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          <span
            className="rounded-sm px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-black"
            style={{ background: catColor }}
          >
            {category}
          </span>
          <span className="rounded-sm border border-white/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/60">
            {sessions.length} session{sessions.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>
    </Link>
  );
}

function Tag({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="rounded-sm px-1.5 py-0.5 text-[10px] font-black text-black"
      style={{ background: color }}
    >
      {children}
    </span>
  );
}
