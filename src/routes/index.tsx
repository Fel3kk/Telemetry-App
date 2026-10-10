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
  racePosition,
  appEmbedUrl,
  type Session,
} from "@/lib/f1-shell";
import { ShellHeader, ShellPage } from "@/components/f1/ShellHeader";
import { shareSeasonStats } from "@/lib/share-stats";

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

  useEffect(() => {
    let cancelled = false;
    // Fresh cache (<15s old, e.g. just came from a subpage): paint instantly,
    // skip the network round-trip entirely.
    if (!cacheIsFresh() || sessions.length === 0) {
      fetchSessions()
        .then((rows) => {
          if (!cancelled) setSessions(rows);
        })
        .catch((e) => {
          if (!cancelled) setErr(String(e));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }
    const onMsg = (e: MessageEvent) => {
      if (e?.data?.type !== "f1-upload" && e?.data?.type !== "f1-sessions-updated") return;
      fetchSessions()
        .then((rows) => !cancelled && setSessions(rows))
        .catch(() => {});
    };
    window.addEventListener("message", onMsg);
    return () => {
      cancelled = true;
      window.removeEventListener("message", onMsg);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const saved = getSavedSeason();
    if (saved) setSeason(saved);
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
        <section className="mb-5 rounded-2xl border border-border bg-card/60 p-3 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Season</span>
              <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-background/60 p-1">
                {SEASONS.map((n) => (
                  <button
                    key={n}
                    onClick={() => pick(n)}
                    className={
                      "min-w-[38px] rounded-lg px-2 py-1.5 text-sm font-bold transition " +
                      (season === n
                        ? "bg-primary text-primary-foreground shadow-[0_4px_18px_-4px_var(--primary)]"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground")
                    }
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Link
                to="/season/$season/title"
                params={{ season: String(season) }}
                className="rounded-lg border border-border bg-background/60 px-4 py-2 text-center text-[11px] font-bold uppercase tracking-[0.15em] text-foreground/80 transition hover:border-primary/60 hover:bg-primary/10 hover:text-foreground"
              >
                🏆 Title Race
              </Link>
              <Link
                to="/records"
                className="rounded-lg border border-border bg-background/60 px-4 py-2 text-center text-[11px] font-bold uppercase tracking-[0.15em] text-foreground/80 transition hover:border-primary/60 hover:bg-primary/10 hover:text-foreground"
              >
                ⏱️ Records
              </Link>
            </div>
          </div>
          <div className="mt-3 border-t border-border pt-3">
            <UploadPanel season={season} />
          </div>
        </section>

        <StatsBar stats={stats} season={season} />


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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
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
  const [height, setHeight] = useState(112);

  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      const d = ev?.data;
      if (d?.type === "f1-embed-height" && d.view === "upload") {
        const h = Number(d.height);
        if (Number.isFinite(h)) setHeight(Math.min(Math.max(h + 4, 96), 260));
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  return (
    <iframe
      title="Upload sessions"
      src={src}
      className="block w-full border-0 bg-transparent"
      style={{ height }}
    />
  );
}

function StatsBar({ stats, season }: { stats: ReturnType<typeof seasonStats>; season: number }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const items = [
    { label: "GP Wins", value: stats.raceWins, icon: "🏆" },
    { label: "Sprint Wins", value: stats.sprintWins, icon: "🏁" },
    { label: "GP Poles", value: stats.gpPoles, icon: "⏱️" },
    { label: "Sprint Poles", value: stats.sprintPoles, icon: "⚡" },
    { label: "Fastest Laps", value: stats.fastestLaps, icon: "💜" },
    { label: "DNFs", value: stats.dnfs, icon: "💥" },
  ];
  const onShare = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await shareSeasonStats({ season, ...stats });
      setMsg(res === "shared" ? "Shared ✓" : "Image saved ✓");
    } catch {
      setMsg("Could not create the image");
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(null), 4000);
    }
  };
  return (
    <div className="mb-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {items.map((it) => (
          <div key={it.label} className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-3">
            <div className="text-[10px] uppercase tracking-widest text-white/50">{it.label}</div>
            <div className="mt-1 text-lg font-black sm:text-xl">{it.icon} {it.value}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-2">
        {msg && <span className="text-[11px] text-white/50">{msg}</span>}
        <button
          onClick={onShare}
          disabled={busy}
          className="rounded-md border border-white/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white/70 transition hover:border-red-500/60 hover:text-white disabled:opacity-50"
        >
          {busy ? "Creating…" : "📤 Share season card"}
        </button>
      </div>
    </div>

  );
}

function TrackCard({ season, track, category, sessions }: { season: number; track: string; category: string; sessions: Session[] }) {
  const badgeAgg: Record<string, boolean> = {};
  sessions.forEach((s) => {
    const b = badgesFor(s);
    Object.entries(b).forEach(([k, v]) => { if (v) badgeAgg[k] = true; });
  });
  const positions = sessions.map(racePosition).filter((n): n is number => !!n);
  const bestPos = positions.length ? Math.min(...positions) : null;
  const [imgSrc, setImgSrc] = useState(trackMapUrl(track));
  const [imgOk, setImgOk] = useState(true);
  const triedFallback = useMemo(() => ({ v: false }), [track]);
  const display = titleCaseTrack(track);
  const isSprint = category === "Sprint";
  const isPractice = category === "Practice";
  // Headline result: the race session with the best finish
  const main = sessions
    .filter((s) => racePosition(s))
    .sort((a, b) => (racePosition(a) ?? 99) - (racePosition(b) ?? 99))[0];
  const fin = main ? racePosition(main) : null;
  const start = main?.starting_position ?? null;
  const gained = fin && start ? start - fin : null;
  return (
    <Link
      to="/season/$season/track/$track"
      params={{ season: String(season), track: trackSlug(track) }}
      search={{ cat: category }}
      className="group relative isolate flex min-h-[190px] flex-col justify-end overflow-hidden rounded-xl border border-white/10 bg-[#0c0c10] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.8)] transition duration-300 hover:-translate-y-1 hover:border-red-500/50 hover:shadow-[0_14px_36px_-12px_rgba(239,68,68,0.4)] sm:min-h-[260px]"
    >
      {/* Track map as a large, faded background layer */}
      {imgOk ? (
        <img
          src={imgSrc}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          className="pointer-events-none absolute -right-[12%] -top-[8%] -z-10 h-[115%] w-[90%] object-contain opacity-40 saturate-[1.2] transition duration-500 group-hover:-translate-x-2 group-hover:scale-105 group-hover:opacity-70"
          onError={() => {
            if (!triedFallback.v) { triedFallback.v = true; setImgSrc(trackMapFallbackUrl(track)); }
            else setImgOk(false);
          }}
        />
      ) : (
        <div className="pointer-events-none absolute -right-4 -top-6 -z-10 text-[9rem] leading-none opacity-10">{trackFlag(track)}</div>
      )}
      {/* Readability gradients */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-[#0c0c10] via-[#0c0c10]/75 to-transparent" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-[#0c0c10]/90 via-transparent to-transparent" />
      <span className={"absolute inset-y-0 left-0 w-[3px] " + (isSprint ? "bg-amber-400" : isPractice ? "bg-slate-400" : "bg-red-500") + " opacity-60 transition group-hover:opacity-100"} />

      <div className="absolute right-3 top-3 flex flex-wrap justify-end gap-1">
        {badgeAgg.gs && <Tag color="#c084fc">GS</Tag>}
        {badgeAgg.win && <Tag color="#ffd700">W</Tag>}
        {badgeAgg.fl && <Tag color="#a855f7">FL</Tag>}
        {!badgeAgg.win && badgeAgg.podium && bestPos && <Tag color="#cd7f32">P{bestPos}</Tag>}
        {badgeAgg.dnf && <Tag color="#ef4444">DNF</Tag>}
      </div>
      <div className="absolute left-4 top-3 flex items-center gap-1.5">
        <span
          className={
            "rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.15em] " +
            (isSprint ? "border border-amber-400/70 bg-black/40 text-amber-300" : isPractice ? "bg-slate-500 text-white" : "bg-red-500 text-white")
          }
        >
          {category}
        </span>
        <span className="rounded bg-black/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/60 backdrop-blur-sm">
          {sessions.length} session{sessions.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="flex flex-col gap-1.5 px-4 pb-3.5 pt-14 sm:gap-2 sm:pb-4 sm:pt-16">
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none">{trackFlag(track)}</span>
          <span className="truncate text-xl font-black uppercase italic tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] sm:text-2xl">{display}</span>
        </div>
        {fin ? (
          <div className="flex items-end justify-between">
            <div className="flex items-baseline gap-2 font-mono">
              {start && <span className="text-sm text-white/45">P{start}</span>}
              {start && <span className="text-white/30">→</span>}
              <span className={"text-3xl font-black leading-none sm:text-4xl " + (fin === 1 ? "text-yellow-400" : fin <= 3 ? "text-orange-300" : "text-white")}>
                P{fin}
              </span>
            </div>
            {gained !== null && gained !== 0 && (
              <span className={"rounded px-1.5 py-0.5 font-mono text-xs font-bold " + (gained > 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400")}>
                {gained > 0 ? `▲ +${gained}` : `▼ ${gained}`}
              </span>
            )}
          </div>
        ) : (
          <div className="text-xs font-semibold uppercase tracking-wider text-white/35">No race result yet</div>
        )}
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
