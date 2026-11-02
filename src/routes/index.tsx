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
  isRaceResultSession,
  roundOrder,
  type Session,
} from "@/lib/f1-shell";
import { ShellHeader, ShellPage } from "@/components/f1/ShellHeader";
import { TemplateExamples } from "@/components/f1/TemplateExamples";
import { shareSeasonStats } from "@/lib/share-stats";
import { seasonSummary } from "@/lib/f1-stats";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "F1 Telemetry Analyzer" },
      { name: "description", content: "Season standings, race stories, and telemetry from your F1 uploads." },
      { property: "og:title", content: "F1 Telemetry Analyzer" },
      { property: "og:description", content: "Season standings, race stories, and telemetry from your F1 uploads." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MainPage,
});

const SEASONS = Array.from({ length: 10 }, (_, i) => i + 1);

const ACTION_CLS =
  "flex min-w-0 items-center justify-center gap-1 rounded-lg border border-border bg-background/60 px-2 py-2 text-[10px] font-bold uppercase tracking-[0.06em] text-foreground/80 transition hover:-translate-y-0.5 hover:border-primary/60 hover:bg-primary/10 hover:text-foreground active:translate-y-0 sm:gap-1.5 sm:px-4 sm:text-[11px] sm:tracking-[0.15em]";

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
  // Rounds follow the order tracks were first driven, so modded tracks slot in naturally.
  const rounds = useMemo(() => roundOrder(seasonSessions), [seasonSessions]);
  const [sortBy, setSortBy] = useState<SortKey>("round");
  useEffect(() => {
    const v = localStorage.getItem("f1.cards.sort") as SortKey | null;
    if (v && SORTS.some((o) => o.key === v)) setSortBy(v);
  }, []);
  const changeSort = (k: SortKey) => { setSortBy(k); localStorage.setItem("f1.cards.sort", k); };
  const trackGroups = useMemo(() => {
    const byRound = (a: any, b: any) =>
      (rounds.get(trackSlug(a.track)) ?? 999) - (rounds.get(trackSlug(b.track)) ?? 999) ||
      (a.category === "Sprint" ? -1 : 0) - (b.category === "Sprint" ? -1 : 0);
    const newest = (g: any) => Math.max(0, ...g.sessions.map((s: Session) => Date.parse(s.created_at || "") || 0));
    const best = (g: any) => Math.min(99, ...g.sessions.map((s: Session) => racePosition(s) ?? 99));
    const cmp: Record<SortKey, (a: any, b: any) => number> = {
      round: byRound,
      newest: (a, b) => newest(b) - newest(a) || byRound(a, b),
      oldest: (a, b) => newest(a) - newest(b) || byRound(a, b),
      best: (a, b) => best(a) - best(b) || byRound(a, b),
      name: (a, b) => String(a.track).localeCompare(String(b.track)) || byRound(a, b),
    };
    return groupByTrack(seasonSessions).sort(cmp[sortBy]);
  }, [seasonSessions, rounds, sortBy]);

  const pick = (n: number) => { setSeason(n); setSavedSeason(n); };

  return (
    <>
      <ShellHeader crumbs={[{ label: `Season ${season}` }]} />
      <ShellPage>
        <section className="mb-4 rounded-2xl border border-border bg-card/60 p-2.5 sm:mb-5 sm:p-4">
          <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-4">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Season
              </span>
              <div className="flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto rounded-xl border border-border bg-background/60 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {SEASONS.map((n) => (
                  <button
                    key={n}
                    onClick={() => pick(n)}
                    aria-pressed={season === n}
                    className={
                      "min-w-[28px] shrink-0 rounded-lg px-1.5 py-1.5 text-xs font-bold tabular-nums transition sm:min-w-[36px] sm:px-2 sm:text-sm " +
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
            <div className="grid grid-cols-3 gap-1.5 sm:flex sm:justify-end sm:gap-2">
              <Link
                to="/season/$season/title"
                params={{ season: String(season) }}
                className={ACTION_CLS}
              >
                🏆
                <span className="truncate">
                  Title<span className="hidden sm:inline"> Race</span>
                </span>
              </Link>
              <Link
                to="/records"
                className={ACTION_CLS}
              >
                ⏱️
                <span className="truncate">Records</span>
              </Link>
              <ShareButton season={season} sessions={seasonSessions} />
            </div>
          </div>
          <div className="mt-2.5 border-t border-border pt-2.5 sm:mt-3 sm:pt-3">
            <UploadPanel season={season} />
            <div className="mt-1 flex justify-end">
              <TemplateExamples />
            </div>
          </div>
        </section>

        <StatsBar stats={stats} />


        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest text-white/60">
            Tracks · Season {season}
          </h2>
          <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Sort
            <select
              value={sortBy}
              onChange={(e) => changeSort(e.target.value as SortKey)}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs font-semibold normal-case tracking-normal text-foreground"
            >
              {SORTS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </label>
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
              round={rounds.get(trackSlug(g.track)) ?? null}
            />
          ))}
        </div>
      </ShellPage>
    </>
  );
}

type SortKey = "round" | "newest" | "oldest" | "best" | "name";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "round", label: "Round order" },
  { key: "newest", label: "Newest first" },
  { key: "oldest", label: "Oldest first" },
  { key: "best", label: "Best finish" },
  { key: "name", label: "Track A–Z" },
];

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

function StatsBar({ stats }: { stats: ReturnType<typeof seasonStats> }) {
  const items = [
    { label: "GP Wins", value: stats.raceWins, icon: "🏆" },
    { label: "Sprint Wins", value: stats.sprintWins, icon: "🏁" },
    { label: "GP Poles", value: stats.gpPoles, icon: "⏱️" },
    { label: "Sprint Poles", value: stats.sprintPoles, icon: "⚡" },
    { label: "Fastest Laps", value: stats.fastestLaps, icon: "💜" },
    { label: "DNFs", value: stats.dnfs, icon: "💥" },
  ];
  return (
    <div className="mb-5 grid grid-cols-3 gap-1.5 sm:mb-6 sm:grid-cols-6 sm:gap-2">
      {items.map((it) => (
        <div
          key={it.label}
          className="min-w-0 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2 transition hover:border-white/20 sm:px-3 sm:py-3"
        >
          <div className="truncate text-[9px] uppercase tracking-[0.1em] text-white/50 sm:text-[10px] sm:tracking-widest">
            {it.label}
          </div>
          <div className="mt-0.5 flex items-baseline gap-1 font-black sm:mt-1">
            <span className="shrink-0 text-sm sm:text-base">{it.icon}</span>
            <span className="truncate text-base tabular-nums sm:text-xl">{it.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ShareButton({ season, sessions }: { season: number; sessions: Session[] }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const onShare = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await shareSeasonStats(seasonSummary(sessions, season));
      setMsg(res === "shared" ? "Shared ✓" : "Image saved ✓");
    } catch {
      setMsg("Could not create the image");
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(null), 4000);
    }
  };
  return (
    <>
      <button
        onClick={onShare}
        disabled={busy}
        className={ACTION_CLS + " disabled:cursor-not-allowed disabled:opacity-50"}
      >
        📤
        <span className="truncate">
          {busy ? "Creating…" : "Share"}
          <span className="hidden sm:inline">{" "}season card</span>
        </span>
      </button>
      {msg && (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
          <span className="rounded-full border border-border bg-card/95 px-4 py-2 text-xs font-semibold shadow-[0_10px_30px_-10px_rgba(0,0,0,0.9)] backdrop-blur">
            {msg}
          </span>
        </div>
      )}
    </>
  );
}

function TrackCard({ season, track, category, sessions, round }: { season: number; track: string; category: string; sessions: Session[]; round: number | null }) {
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
  // Retired with no classified finish: show the grid slot and the DNF instead of "no result".
  const dnfSession = !main ? sessions.find((s) => isRaceResultSession(s) && badgesFor(s).dnf) : undefined;
  const dnfStart = dnfSession?.starting_position ?? null;
  const dnfLaps = (() => {
    if (!dnfSession) return null;
    const me = String(dnfSession.race_story?.player_name || dnfSession.driver_name || "").toUpperCase();
    const row = (dnfSession.race_story?.classification ?? []).find((e: any) => String(e?.name || "").toUpperCase() === me);
    return Number(row?.laps) || null;
  })();
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
        {round != null && (
          <span className="rounded bg-black/50 px-1.5 py-0.5 font-mono text-[10px] font-black text-white/80 backdrop-blur-sm">
            R{round}
          </span>
        )}
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
        ) : dnfSession ? (
          <div className="flex items-end justify-between">
            <div className="flex items-baseline gap-2 font-mono">
              {dnfStart && <span className="text-sm text-white/45">P{dnfStart}</span>}
              {dnfStart && <span className="text-white/30">→</span>}
              <span className="text-3xl font-black leading-none text-red-400 sm:text-4xl">DNF</span>
            </div>
            {dnfLaps && (
              <span className="rounded bg-red-500/15 px-1.5 py-0.5 font-mono text-xs font-bold text-red-400">
                Lap {dnfLaps}
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
