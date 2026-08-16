import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchSessions,
  loadCachedSessions,
  trackSlug,
  trackFlag,
  trackMapUrl,
  trackMapFallbackUrl,
  titleCaseTrack,
  badgesFor,
  racePosition,
  type Session,
} from "@/lib/f1-shell";
import { supabase } from "@/lib/supabase";
import { ShellHeader, ShellPage } from "@/components/f1/ShellHeader";

export const Route = createFileRoute("/season/$season/track/$track/")({
  component: TrackPage,
});

type Opt = { view: string; label: string; icon: string; desc: string };

const OPTIONS: Opt[] = [
  {
    view: "standings",
    label: "Standings",
    icon: "🏆",
    desc: "Full season table for the championship",
  },
  {
    view: "records",
    label: "All-Time Records",
    icon: "📚",
    desc: "Career points, wins, podiums, DOTD",
  },
  {
    view: "progress",
    label: "Season Progress",
    icon: "📈",
    desc: "Points & position by round, drivers and teams",
  },
  { view: "quali-results", label: "Qualifying", icon: "⏱️", desc: "Q1–Q3 / shootout times" },
  { view: "grid", label: "Starting Grid", icon: "🚦", desc: "Pole to the back row, weekend lineup" },
  { view: "assignments", label: "Teams", icon: "🏎️", desc: "Driver / constructor pairings" },
  {
    view: "race-story",
    label: "Race Story",
    icon: "🎬",
    desc: "Position changes, stints, classification",
  },
  {
    view: "compare",
    label: "Compare Lap Times",
    icon: "🆚",
    desc: "Compare your lap times against any driver",
  },
  { view: "graphs", label: "Graphs", icon: "📊", desc: "Lap times, fuel, ERS, tyre wear + faults" },
  { view: "data", label: "Laps", icon: "📋", desc: "Per-lap table and stint summary" },
  { view: "practice", label: "Practice", icon: "🏁", desc: "Free practice fuel calculator" },
  {
    view: "teammate",
    label: "Teammate H2H",
    icon: "🤝",
    desc: "Every team's driver comparison this season",
  },
];

function matchesCat(s: Session, bucket: string | undefined) {
  const c = s.category || "Race";
  // Practice always surfaces alongside the race weekend regardless of cat filter.
  if (c === "Practice") return true;
  if (!bucket) return true;
  if (bucket === "Sprint")
    return c === "Sprint" || c === "Sprint Qualifying" || c === "Sprint Shootout";
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
    fetchSessions()
      .then(setSessions)
      .catch(() => {});

  }, [seasonN]);

  // Load persisted ordering
  useEffect(() => {
    const key = `f1.track.order.v1`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const saved: string[] = JSON.parse(raw);
        const known = OPTIONS.map((o) => o.view);
        const merged = [
          ...saved.filter((v) => known.includes(v)),
          ...known.filter((v) => !saved.includes(v)),
        ];
        setOrder(merged);
      }
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(`f1.track.order.v1`, JSON.stringify(order));
    } catch {}
  }, [order]);

  const trackSessions = useMemo(
    () =>
      sessions.filter(
        (s) =>
          Number(s.season) === seasonN &&
          trackSlug(s.track_name) === trackSlug(track) &&
          matchesCat(s, cat),
      ),
    [sessions, track, seasonN, cat],
  );
  const canonicalName = trackSessions[0]?.track_name ?? track;
  // Seasons (other than this one) that contain a track with the same name.
  const sameTrackSeasons = useMemo(() => {
    const set = new Set<number>();
    sessions.forEach((s) => {
      if (trackSlug(s.track_name) === trackSlug(track)) set.add(Number(s.season));
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [sessions, track]);
  const prevSeason = useMemo(
    () => [...sameTrackSeasons].reverse().find((n) => n < seasonN),
    [sameTrackSeasons, seasonN],
  );
  const nextSeason = useMemo(
    () => sameTrackSeasons.find((n) => n > seasonN),
    [sameTrackSeasons, seasonN],
  );

  // Rounds of this season, ordered by when each weekend was run.
  const seasonRounds = useMemo(() => {
    const first = new Map<string, { slug: string; name: string; t: number }>();
    sessions
      .filter((x) => Number(x.season) === seasonN)
      .forEach((x) => {
        const slug = trackSlug(x.track_name);
        if (!slug) return;
        const t = new Date(x.created_at || 0).getTime() || 0;
        const cur = first.get(slug);
        if (!cur || t < cur.t) first.set(slug, { slug, name: x.track_name, t });
      });
    return Array.from(first.values()).sort((a, b) => a.t - b.t);
  }, [sessions, seasonN]);
  const roundIdx = seasonRounds.findIndex((r) => r.slug === trackSlug(track));
  const prevRound = roundIdx > 0 ? seasonRounds[roundIdx - 1] : undefined;
  const nextRound =
    roundIdx >= 0 && roundIdx < seasonRounds.length - 1 ? seasonRounds[roundIdx + 1] : undefined;

  const displayName = titleCaseTrack(canonicalName);
  const cats = Array.from(new Set(trackSessions.map((s) => s.category).filter(Boolean)));
  const race = trackSessions.find((s) => s.category === "Race");
  const infoSummary = race?.session_info
    ? `${race.session_info.track_name ?? canonicalName} · ${race.session_info.total_laps ?? "?"} laps · ${race.session_info.weather ?? ""}`
    : `Session data for ${canonicalName}`;

  const bestRacePos = (() => {
    const ps = trackSessions.map(racePosition).filter((n): n is number => !!n);
    return ps.length ? Math.min(...ps) : null;
  })();
  const badgeAgg: Record<string, boolean> = {};
  trackSessions.forEach((s) => {
    const b = badgesFor(s);
    Object.entries(b).forEach(([k, v]) => {
      if (v) badgeAgg[k] = true;
    });
  });

  // Guards so an empty initial state can never overwrite stored notes:
  // saving only starts once the DB read for this track has settled, and we
  // never re-write a value identical to what we last loaded/saved.
  const [notesReady, setNotesReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "editing" | "saving" | "saved" | "local" | "error"
  >("idle");
  const lastSaved = useRef<string | null>(null);
  const saveSequence = useRef(0);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const notesRef = useRef("");
  const notesReadyRef = useRef(false);
  const noteTrackKey = trackSlug(track);
  const trackKeyRef = useRef(noteTrackKey);
  notesRef.current = notes;
  notesReadyRef.current = notesReady;

  // Writes the given value for the given track key. Serialized so a slower
  // older request can never overwrite a newer note after rapid edits.
  function persistNotes(value: string, dbKey: string, quiet = false) {
    if (!quiet) setSaveStatus("saving");
    const sequence = ++saveSequence.current;
    saveQueue.current = saveQueue.current.catch(() => {}).then(async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData?.user?.id;
        if (!uid) {
          if (!quiet) setSaveStatus("local"); // anonymous → local only
          return;
        }
        // Per-user lookup then update/insert. RLS already scopes reads to the
        // signed-in user, but the table can still hold a legacy row with the
        // same `track_key` owned by nobody/someone else — inserting then hits
        // a duplicate-key error, which is what made saves fail ~50% of tracks.
        const { data: existing } = await supabase
          .from("track_notes")
          .select("id")
          .eq("track_key", dbKey)
          .eq("user_id", uid)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const payload = {
          track_key: dbKey,
          notes: value,
          updated_at: new Date().toISOString(),
          user_id: uid,
        };
        let error = existing?.id
          ? (await supabase.from("track_notes").update(payload).eq("id", existing.id)).error
          : (await supabase.from("track_notes").insert(payload)).error;
        if (error && !existing?.id) {
          // Duplicate key on track_key → a row already exists; take it over.
          const retry = await supabase
            .from("track_notes")
            .update(payload)
            .eq("track_key", dbKey)
            .select("id");
          if (!retry.error && retry.data && retry.data.length) error = null;
        }
        if (error) {
          console.warn("track_notes save failed", error);
          if (!quiet && sequence === saveSequence.current) setSaveStatus("error");
          return;
        }
        if (dbKey === trackKeyRef.current) lastSaved.current = value;
        if (!quiet && sequence === saveSequence.current) setSaveStatus("saved");

      } catch (err) {
        console.warn("track_notes save error", err);
        if (!quiet && sequence === saveSequence.current) setSaveStatus("error");
      }
    });
    return saveQueue.current;
  }

  useEffect(() => {
    const localKey = `f1.notes.${seasonN}.${noteTrackKey}`;
    trackKeyRef.current = noteTrackKey;
    setNotesReady(false);
    setSaveStatus("idle");
    lastSaved.current = null;
    // Load local cache immediately
    const local = localStorage.getItem(localKey) || "";
    setNotes(local);

    // Try to load DB-backed notes for this track (per-track, not per-season)
    let mounted = true;
    (async () => {
      try {
        const dbKey = noteTrackKey;
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData?.user?.id;
        let query = supabase
          .from("track_notes")
          .select("notes")
          .eq("track_key", dbKey)
          .order("updated_at", { ascending: false })
          .limit(1);
        if (uid) query = query.eq("user_id", uid);
        const { data, error } = await query.maybeSingle();
        if (!mounted) return;
        if (error) {
          // keep the local value and treat it as the baseline so we never
          // overwrite the stored note with an empty editor state
          console.warn("load track_notes failed", error);
          lastSaved.current = local;
          setNotesReady(true);
          return;
        }
        const remote = data?.notes ?? "";
        if (remote.trim()) {
          // Remote wins unless the local draft is a strict superset that never
          // reached the database (e.g. navigation cut a pending save short).
          const useLocal = local.trim() && local !== remote && local.startsWith(remote);
          const value = useLocal ? local : remote;
          setNotes(value);
          lastSaved.current = remote;
          try {
            localStorage.setItem(localKey, value);
          } catch (_) {}
          if (useLocal && uid) persistNotes(value, dbKey, true);
        } else if (local.trim()) {
          // Nothing (or an empty row) in the database but we still hold a local
          // draft → push it up instead of letting the empty row win.
          lastSaved.current = remote;
          if (uid) persistNotes(local, dbKey, true);
        } else {
          lastSaved.current = local;
        }
        setNotesReady(true);
      } catch (err) {
        console.warn("track_notes load error", err);
        if (!mounted) return;
        lastSaved.current = local;
        setNotesReady(true);
      }
    })();
    return () => {
      mounted = false;
      // Flush any unsaved edits for the track we are leaving.
      if (notesReadyRef.current && notesRef.current !== lastSaved.current) {
        persistNotes(notesRef.current, noteTrackKey, true);
      }
    };
  }, [seasonN, noteTrackKey]);

  // Flush on tab close / refresh too.
  useEffect(() => {
    const onHide = () => {
      if (notesReadyRef.current && notesRef.current !== lastSaved.current) {
        persistNotes(notesRef.current, trackKeyRef.current, true);
      }
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") onHide();
    });
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  useEffect(() => {
    if (!notesReady) return;
    if (notes !== lastSaved.current) setSaveStatus("editing");
    const localKey = `f1.notes.${seasonN}.${noteTrackKey}`;
    // Local persistence is synchronous so a quick navigation cannot discard
    // the latest keystrokes while the database debounce is still pending.
    try {
      localStorage.setItem(localKey, notes);
    } catch (_) {}
    const id = setTimeout(() => {
      if (notes === lastSaved.current) return;
      persistNotes(notes, noteTrackKey);
    }, 700);
    return () => clearTimeout(id);
  }, [notes, notesReady, seasonN, noteTrackKey]);


  const saveLabel: Record<string, string> = {
    idle: "",
    editing: "Editing…",
    saving: "Saving…",
    saved: "Saved ✓",
    local: "Saved on this device (sign in to sync)",
    error: "Save failed — retry by editing again",
  };



  const notesTemplate = `SOFTS:\n\nMEDIUMS:\n\nHARDS:\n\nBATTERY MANAGEMENT:\n`;

  const [imgOk, setImgOk] = useState(true);
  const [imgSrc, setImgSrc] = useState<string>("");
  const triedFallback = useMemo(() => ({ v: false }), [canonicalName]);
  useEffect(() => {
    setImgSrc(trackMapUrl(canonicalName));
    setImgOk(true);
    triedFallback.v = false;
  }, [canonicalName, triedFallback]);

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
            {(prevSeason || nextSeason) && (
              <div className="mb-3 flex flex-wrap items-center gap-2" suppressHydrationWarning>
                <span className="text-[11px] uppercase tracking-widest text-white/40">
                  Same track
                </span>
                {prevSeason && (
                  <Link
                    to="/season/$season/track/$track"
                    params={{ season: String(prevSeason), track: trackSlug(track) }}
                    search={{ cat }}
                    className="rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-white hover:border-red-500/60"
                  >
                    ← Season {prevSeason}
                  </Link>
                )}
                {nextSeason && (
                  <Link
                    to="/season/$season/track/$track"
                    params={{ season: String(nextSeason), track: trackSlug(track) }}
                    search={{ cat }}
                    className="rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-white hover:border-red-500/60"
                  >
                    Season {nextSeason} →
                  </Link>
                )}
              </div>
            )}

            {(prevRound || nextRound) && (
              <div className="mb-3 flex flex-wrap items-center gap-2" suppressHydrationWarning>
                <span className="text-[11px] uppercase tracking-widest text-white/40">
                  Round {roundIdx + 1} / {seasonRounds.length}
                </span>
                {prevRound && (
                  <Link
                    to="/season/$season/track/$track"
                    params={{ season: String(seasonN), track: prevRound.slug }}
                    search={{ cat }}
                    className="rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-white hover:border-red-500/60"
                  >
                    ← {titleCaseTrack(prevRound.name)}
                  </Link>
                )}
                {nextRound && (
                  <Link
                    to="/season/$season/track/$track"
                    params={{ season: String(seasonN), track: nextRound.slug }}
                    search={{ cat }}
                    className="rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-white hover:border-red-500/60"
                  >
                    {titleCaseTrack(nextRound.name)} →
                  </Link>
                )}
              </div>
            )}

            <div className="mb-3 flex flex-wrap gap-2" suppressHydrationWarning>
              {cats.map((c) => (
                <span
                  key={c}
                  className="rounded border border-white/15 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-white/70"
                >
                  {c}
                </span>
              ))}
              {badgeAgg.gs && <Tag color="#c084fc">Grand Slam</Tag>}
              {badgeAgg.win && <Tag color="#ffd700">Win</Tag>}
              {!badgeAgg.win && badgeAgg.podium && bestRacePos && (
                <Tag color="#cd7f32">P{bestRacePos}</Tag>
              )}
              {badgeAgg.pole && <Tag color="#5ad1ff">Pole</Tag>}
              {badgeAgg.fl && <Tag color="#a855f7">Fastest Lap</Tag>}
            </div>
            <p className="mb-4 text-sm text-white/70">{infoSummary}</p>
            <div className="mb-1 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <label className="block text-xs uppercase tracking-widest text-white/50">Notes</label>
                <span
                  className={
                    "text-[11px] font-semibold " +
                    (saveStatus === "saved"
                      ? "text-emerald-400"
                      : saveStatus === "error"
                        ? "text-red-400"
                        : "text-white/45")
                  }
                >
                  {saveLabel[saveStatus]}
                </span>
              </div>

              {!notes && (
                <button
                  type="button"
                  onClick={() => setNotes(notesTemplate)}
                  className="text-[11px] font-semibold uppercase tracking-wider text-red-400 hover:text-red-300"
                >
                  Insert template
                </button>
              )}
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={notesTemplate}
              className="min-h-[340px] w-full resize-y whitespace-pre-wrap rounded-md border border-white/10 bg-white/[0.03] p-3 font-mono text-sm leading-relaxed text-white outline-none focus:border-red-500/60"
            />
          </div>
          <div className="overflow-hidden rounded-lg border border-white/10 bg-black/40">
            {imgOk ? (
              <img
                src={imgSrc || trackMapUrl(canonicalName)}
                alt={canonicalName}
                className="h-full w-full object-contain p-4"
                onError={() => {
                  if (!triedFallback.v) {
                    triedFallback.v = true;
                    setImgSrc(trackMapFallbackUrl(canonicalName));
                  } else setImgOk(false);
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
              ? {
                  to: "/season/$season/teammate" as const,
                  params: { season },
                  search: undefined as any,
                }
              : {
                  to: "/season/$season/track/$track/$view" as const,
                  params: { season, track, view: o.view },
                  search: { cat },
                };
            return (
              <div
                key={o.view}
                draggable
                onDragStart={() => setDragging(o.view)}
                onDragEnd={() => setDragging(null)}
                onDragOver={(e) => {
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragging) reorder(dragging, o.view);
                }}
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
    <span
      className="rounded-sm px-2 py-0.5 text-[11px] font-black text-black"
      style={{ background: color }}
    >
      {children}
    </span>
  );
}
