import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  fetchSessions,
  loadCachedSessions,
  trackSlug,
  trackFlag,
  trackMapUrl,
  trackMapFallbackUrl,
  titleCaseTrack,
  badgesFor,
  type Session,
} from "@/lib/f1-shell";
import { ShellHeader, ShellPage } from "@/components/f1/ShellHeader";

export const Route = createFileRoute("/season/$season/track/$track/")({
  component: TrackPage,
});

type Opt = { view: string; label: string; icon: string; desc: string };

const OPTIONS: Opt[] = [
  { view: "standings",   label: "Standings",        icon: "🏆", desc: "Full season table for the championship" },
  { view: "records",     label: "All-Time Records", icon: "📚", desc: "Career points, wins, podiums, DOTD" },
  { view: "quali-results", label: "Qualifying",     icon: "⏱️", desc: "Q1–Q3 / shootout times" },
  { view: "assignments", label: "Teams",            icon: "🏎️", desc: "Driver / constructor pairings" },
  { view: "race-story",  label: "Race Story",       icon: "🎬", desc: "Position changes, stints, classification" },
  { view: "compare",     label: "Compare Lap Times", icon: "🆚", desc: "Compare your lap times against any driver" },
  { view: "graphs",      label: "Graphs",           icon: "📊", desc: "Lap times, fuel, ERS, tyre wear + faults" },
  { view: "data",        label: "Laps",             icon: "📋", desc: "Per-lap table and stint summary" },
  { view: "practice",    label: "Practice",         icon: "🏁", desc: "Free practice fuel calculator" },
  { view: "teammate",    label: "Teammate H2H",     icon: "🤝", desc: "Every team's driver comparison this season" },
];

function matchesCat(s: Session, bucket: string | undefined) {
  const c = s.category || "Race";
  // Practice always surfaces alongside the race weekend regardless of cat filter.
  if (c === "Practice") return true;
  if (!bucket) return true;
  if (bucket === "Sprint") return c === "Sprint" || c === "Sprint Qualifying" || c === "Sprint Shootout";
  return c !== "Sprint" && c !== "Sprint Qualifying" && c !== "Sprint Shootout";
}

function TrackPage() {
  const { season, track } = Route.useParams();
  const { cat } = Route.useSearch();
  const seasonN = Number(season);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [notes, setNotes] = useState("");
  const [order, setOrder] = useState<string[]>(OPTIONS.map((o) => o.view));
  const [dragging, setDragging] = useState<string | null>(null);

  // Load cached sessions after mount to avoid SSR hydration mismatch.
  useEffect(() => {
    const cached = loadCachedSessions();
    if (cached) setSessions(cached);
    fetchSessions(seasonN).then(setSessions).catch(() => {});
  }, [seasonN]);

  // Load persisted ordering
  useEffect(() => {
    const key = `f1.track.order.v1`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const saved: string[] = JSON.parse(raw);
        const known = OPTIONS.map((o) => o.view);
        const merged = [...saved.filter((v) => known.includes(v)), ...known.filter((v) => !saved.includes(v))];
        setOrder(merged);
      }
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(`f1.track.order.v1`, JSON.stringify(order)); } catch {}
  }, [order]);

  const trackSessions = useMemo(
    () => sessions.filter(
      (s) =>
        Number(s.season) === seasonN &&
        trackSlug(s.track_name) === trackSlug(track) &&
        matchesCat(s, cat),
    ),
    [sessions, track, seasonN, cat],
  );
  const canonicalName = trackSessions[0]?.track_name ?? track;
  const displayName = titleCaseTrack(canonicalName);
  const cats = Array.from(new Set(trackSessions.map((s) => s.category).filter(Boolean)));
  const race = trackSessions.find((s) => s.category === "Race");
  const infoSummary = race?.session_info
    ? `${race.session_info.track_name ?? canonicalName} · ${race.session_info.total_laps ?? "?"} laps · ${race.session_info.weather ?? ""}`
    : `Session data for ${canonicalName}`;

  const badgeAgg: Record<string, boolean> = {};
  trackSessions.forEach((s) => {
    const b = badgesFor(s);
    Object.entries(b).forEach(([k, v]) => { if (v) badgeAgg[k] = true; });
  });

  useEffect(() => {
    const key = `f1.notes.${seasonN}.${trackSlug(track)}`;
    setNotes(localStorage.getItem(key) || "");
  }, [seasonN, track]);
  useEffect(() => {
    const key = `f1.notes.${seasonN}.${trackSlug(track)}`;
    const id = setTimeout(() => localStorage.setItem(key, notes), 400);
    return () => clearTimeout(id);
  }, [notes, seasonN, track]);

  const [imgOk, setImgOk] = useState(true);
  const [imgSrc, setImgSrc] = useState<string>("");
  const triedFallback = useMemo(() => ({ v: false }), [canonicalName]);
  useEffect(() => { setImgSrc(trackMapUrl(canonicalName)); setImgOk(true); triedFallback.v = false; }, [canonicalName, triedFallback]);

  const orderedOptions = useMemo(() => {
    const byView = new Map(OPTIONS.map((o) => [o.view, o]));
    return order.map((v) => byView.get(v)).filter(Boolean) as Opt[];
  }, [order]);

  function reorder(from: string, to: string) {
    if (from === to) return;
    setOrder((prev) => {
      const next = prev.filter((v) => v !== from);
      const idx = next.indexOf(to);
      next.splice(idx < 0 ? next.length : idx, 0, from);
      return next;
    });
  }

  return (
    <>
      <ShellHeader
        crumbs={[
          { label: `Season ${season}`, to: "/" },
          { label: cat ? `${displayName} · ${cat}` : displayName },
        ]}
      />
      <ShellPage>
        <section className="mb-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <span className="text-4xl">{trackFlag(canonicalName)}</span>
              <h1 className="text-3xl font-black">
                {displayName}
                {cat && <span className="ml-3 text-lg font-bold text-white/60">{cat}</span>}
              </h1>
            </div>
            <div className="mb-3 flex flex-wrap gap-2" suppressHydrationWarning>
              {cats.map((c) => (
                <span key={c} className="rounded border border-white/15 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-white/70">
                  {c}
                </span>
              ))}
              {badgeAgg.gs && <Tag color="#c084fc">Grand Slam</Tag>}
              {badgeAgg.win && <Tag color="#ffd700">Win</Tag>}
              {badgeAgg.pole && <Tag color="#5ad1ff">Pole</Tag>}
              {badgeAgg.fl && <Tag color="#a855f7">Fastest Lap</Tag>}
            </div>
            <p className="mb-4 text-sm text-white/70">{infoSummary}</p>
            <label className="mb-1 block text-xs uppercase tracking-widest text-white/50">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Setup notes, strategy ideas, quali splits…"
              className="min-h-[120px] w-full rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm text-white outline-none focus:border-red-500/60"
            />
          </div>
          <div className="overflow-hidden rounded-lg border border-white/10 bg-black/40">
          {imgOk ? (
              <img
                src={imgSrc || trackMapUrl(canonicalName)}
                alt={canonicalName}
                className="h-full w-full object-contain p-4"
                onError={() => {
                  if (!triedFallback.v) { triedFallback.v = true; setImgSrc(trackMapFallbackUrl(canonicalName)); }
                  else setImgOk(false);
                }}
              />
            ) : (
              <div className="flex h-full min-h-[240px] items-center justify-center text-6xl opacity-40">
                {trackFlag(canonicalName)}
              </div>
            )}
          </div>
        </section>

        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest text-white/60">Sections</h2>
          <span className="text-[11px] text-white/40">Drag cards to reorder</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {orderedOptions.map((o) => {
            const isTeammate = o.view === "teammate";
            const linkProps = isTeammate
              ? { to: "/season/$season/teammate" as const, params: { season }, search: undefined as any }
              : { to: "/season/$season/track/$track/$view" as const, params: { season, track, view: o.view }, search: { cat } };
            return (
              <div
                key={o.view}
                draggable
                onDragStart={() => setDragging(o.view)}
                onDragEnd={() => setDragging(null)}
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={(e) => { e.preventDefault(); if (dragging) reorder(dragging, o.view); }}
                className={"flex transition " + (dragging === o.view ? "opacity-40" : "")}
              >
                <Link
                  {...(linkProps as any)}
                  className="group flex h-full w-full items-start gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-4 transition hover:-translate-y-0.5 hover:border-red-500/60 cursor-grab active:cursor-grabbing"
                >
                  <span className="text-2xl">{o.icon}</span>
                  <div className="flex-1">
                    <div className="text-base font-bold">{o.label}</div>
                    <div className="mt-0.5 text-xs text-white/60">{o.desc}</div>
                  </div>
                  <span className="select-none text-white/20 group-hover:text-white/40">⋮⋮</span>
                </Link>
              </div>
            );
          })}
        </div>
      </ShellPage>
    </>
  );
}

function Tag({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="rounded-sm px-2 py-0.5 text-[11px] font-black text-black" style={{ background: color }}>
      {children}
    </span>
  );
}
