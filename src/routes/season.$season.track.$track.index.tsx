import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowLeftRight,
  BookOpen,
  Check,
  ChartLine,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Database,
  FileText,
  Flag,
  Gauge,
  GripVertical,
  Headphones,
  Medal,
  Pencil,
  Route as RouteIcon,
  Timer,
  Trophy,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { parseTrackNotes } from "@/lib/track-notes";
import {
  buildTrackCardPreview,
  formatPreviewLapTime,
  type TrackCardPreview as TrackCardPreviewData,
} from "@/lib/track-card-previews";
import {
  fetchSessions,
  loadCachedSessions,
  cacheIsFresh,
  trackSlug,
  trackFlag,
  titleCaseTrack,
  clearSessionsCache,
  type Session,
} from "@/lib/f1-shell";
import { supabase } from "@/lib/supabase";
import { ShellHeader, ShellPage } from "@/components/f1/ShellHeader";

export const Route = createFileRoute("/season/$season/track/$track/")({
  head: ({ params }) => {
    const title = `${titleCaseTrack(params.track)} · Season ${params.season} · F1 Telemetry`;
    const description = `Qualifying, lap simulations, race analysis and telemetry for ${titleCaseTrack(params.track)} in Season ${params.season}.`;
    return { meta: [{ title }, { name: "description", content: description }, { property: "og:title", content: title }, { property: "og:description", content: description }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] };
  },
  component: TrackPage,
});

type Opt = { view: string; label: string; icon: LucideIcon; desc: string };

const GROUPS = [
  { id: "race", label: "Race Telemetry & Analysis", icon: Flag, views: ["race-story", "compare", "graphs", "data", "ai-debrief"] },
  { id: "quali", label: "Qualifying & Setup", icon: Gauge, views: ["quali-results", "quali-simulation", "ers-map"] },
  { id: "prep", label: "Pre-Race Preparation", icon: Activity, views: ["practice", "strategies", "grid"] },
  { id: "season", label: "Championship & Season", icon: Trophy, views: ["standings", "records", "progress", "assignments", "teammate"] },
] as const;
type GroupId = (typeof GROUPS)[number]["id"];
const GROUP_KEY = "f1.sectionsGroup";

const OPTIONS: Opt[] = [
  {
    view: "standings",
    label: "Standings",
    icon: Trophy,
    desc: "Full season table for the championship",
  },
  {
    view: "records",
    label: "All-Time Records",
    icon: BookOpen,
    desc: "Career points, wins, podiums, DOTD",
  },
  {
    view: "progress",
    label: "Season Progress",
    icon: ChartLine,
    desc: "Points & position by round, drivers and teams",
  },
  { view: "quali-results", label: "Qualifying", icon: Timer, desc: "Q1–Q3 / shootout times" },
  { view: "quali-simulation", label: "Qualifying Simulation", icon: Gauge, desc: "Your lap versus P1, or P2 from pole" },
  { view: "ers-map", label: "ERS Map", icon: Zap, desc: "Paint your race and quali battery plan on the track" },
  { view: "ai-debrief", label: "AI Race Engineer", icon: Headphones, desc: "Debrief, consistency score and coaching notes" },
  { view: "grid", label: "Starting Grid", icon: Flag, desc: "Pole to the back row, weekend lineup" },
  { view: "assignments", label: "Teams", icon: Users, desc: "Driver / constructor pairings" },
  {
    view: "race-story",
    label: "Race Story",
    icon: Activity,
    desc: "Position changes, stints, classification",
  },
  {
    view: "compare",
    label: "Compare Lap Times",
    icon: ArrowLeftRight,
    desc: "Compare your lap times against any driver",
  },
  { view: "graphs", label: "Graphs", icon: ChartLine, desc: "Lap times, fuel, ERS, tyre wear + faults" },
  { view: "data", label: "Laps", icon: ClipboardList, desc: "Per-lap table and stint summary" },
  { view: "practice", label: "Practice", icon: Activity, desc: "Free practice fuel calculator" },
  {
    view: "strategies",
    label: "Possible Strategies",
    icon: RouteIcon,
    desc: "Saved tyre strategies for this track",
  },
  {
    view: "teammate",
    label: "Teammate H2H",
    icon: Medal,
    desc: "Every team's driver comparison this season",
  },
];


const ACCENTS: Record<string, string> = {
  standings: "#ffd15c",
  records: "#cf9bff",
  progress: "#5cb0ff",
  "quali-results": "#4bf09a",
  "quali-simulation": "var(--replay-rival)",
  "ers-map": "#22c55e",
  "ai-debrief": "#5ad1ff",
  grid: "#ff4646",
  assignments: "#ff9c4f",
  "race-story": "#a78bfa",
  compare: "#5ad1ff",
  graphs: "#4bf09a",
  data: "#c3c3d0",
  practice: "#ffd15c",
  strategies: "#ff9c4f",
  teammate: "#ff4646",
};

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
  const [notesOpen, setNotesOpen] = useState(false);
  const [order, setOrder] = useState<string[]>(OPTIONS.map((o) => o.view));
  const [dragging, setDragging] = useState<string | null>(null);
  const [customizingLayout, setCustomizingLayout] = useState(false);
  const [group, setGroup] = useState<GroupId>("race");
  useEffect(() => {
    const g = localStorage.getItem(GROUP_KEY);
    if (g && GROUPS.some((x) => x.id === g)) setGroup(g as GroupId);
  }, []);
  const pickGroup = (g: GroupId) => {
    setGroup(g);
    try { localStorage.setItem(GROUP_KEY, g); } catch { /* ignore */ }
  };

  // Load cached sessions after mount to avoid SSR hydration mismatch.
  // Paint navigation (season/round arrows) from cache before the first frame,
  // then refresh from the network only when the cache is stale.
  useLayoutEffect(() => {
    const cached = loadCachedSessions();
    if (cached) setSessions(cached);
    if (cached && cacheIsFresh()) return;
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
  const hasTrackNavigation = Boolean(prevSeason || nextSeason || prevRound || nextRound);

  const displayName = titleCaseTrack(canonicalName);
  const race = trackSessions.find((s) => s.category === "Race");
  const previewSession =
    trackSessions.find((s) => s.category === "Race" && s.race_story) ??
    trackSessions.find((s) => /sprint/i.test(s.category) && s.race_story) ??
    race ??
    trackSessions.find((s) => s.race_story) ??
    trackSessions[0];
  const cardPreview = useMemo(() => buildTrackCardPreview(previewSession), [previewSession]);
  const infoSummary = race?.session_info
    ? `${race.session_info.track_name ?? canonicalName} · ${race.session_info.total_laps ?? "?"} laps · ${race.session_info.weather ?? ""}`
    : `Session data for ${canonicalName}`;

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
  const noteRows = parseTrackNotes(notes);

  const orderedOptions = useMemo(() => {
    const byView = new Map(OPTIONS.map((o) => [o.view, o]));
    return order.map((v) => byView.get(v)).filter(Boolean) as Opt[];
  }, [order]);
  const visibleOptions = orderedOptions.filter((o) =>
    (GROUPS.find((g) => g.id === group)?.views as readonly string[]).includes(o.view),
  );
  const useRaceCardGrid = group === "race" && visibleOptions.length === 5;

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
        <section className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] lg:items-start">
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center gap-2.5">
              <span className="text-2xl sm:text-3xl">{trackFlag(canonicalName)}</span>
              <h1 className="min-w-0 text-xl font-black sm:text-2xl">
                {displayName}
                {cat && <span className="ml-2 text-sm font-bold text-muted-foreground sm:text-base">{cat}</span>}
              </h1>
            </div>
            {hasTrackNavigation && (
              <div className="mb-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2" suppressHydrationWarning>
                {(prevSeason || nextSeason) && (
                  <NavBar
                    center={`Same track`}
                    prev={
                      prevSeason ? (
                        <NavLink
                          dir="prev"
                          to="/season/$season/track/$track"
                          params={{ season: String(prevSeason), track: trackSlug(track) }}
                          search={{ cat }}
                          label={`Season ${prevSeason}`}
                        />
                      ) : null
                    }
                    next={
                      nextSeason ? (
                        <NavLink
                          dir="next"
                          to="/season/$season/track/$track"
                          params={{ season: String(nextSeason), track: trackSlug(track) }}
                          search={{ cat }}
                          label={`Season ${nextSeason}`}
                        />
                      ) : null
                    }
                  />
                )}
                {(prevRound || nextRound) && (
                  <NavBar
                    center={`Round ${roundIdx + 1} / ${seasonRounds.length}`}
                    prev={
                      prevRound ? (
                        <NavLink
                          dir="prev"
                          to="/season/$season/track/$track"
                          params={{ season: String(seasonN), track: prevRound.slug }}
                          search={{ cat }}
                          label={titleCaseTrack(prevRound.name)}
                        />
                      ) : null
                    }
                    next={
                      nextRound ? (
                        <NavLink
                          dir="next"
                          to="/season/$season/track/$track"
                          params={{ season: String(seasonN), track: nextRound.slug }}
                          search={{ cat }}
                          label={titleCaseTrack(nextRound.name)}
                        />
                      ) : null
                    }
                  />
                )}
              </div>
            )}


            <p className="mb-2.5 text-xs text-muted-foreground">{infoSummary}</p>
            <UploadedSessions
              sessions={sessions.filter(
                (s) =>
                  Number(s.season) === seasonN &&
                  trackSlug(s.track_name) === trackSlug(track),
              )}
              onDeleted={(id) => {
                setSessions((prev) => prev.filter((s) => s.id !== id));
                clearSessionsCache();
              }}
            />
          </div>
          <div className={"min-w-0 " + (hasTrackNavigation ? "lg:mt-[2.625rem]" : "")}>
            <section className="overflow-hidden rounded-xl border border-border/70 bg-card/40">
              <div className="flex min-w-0 items-center justify-between gap-3 px-3 py-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <FileText size={17} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="truncate text-xs font-bold uppercase tracking-widest text-foreground">
                    Track notes
                  </span>
                  <span
                    className={
                      "shrink-0 text-[10px] font-semibold " +
                      (saveStatus === "saved"
                        ? "text-emerald-400"
                        : saveStatus === "error"
                          ? "text-red-400"
                          : "text-muted-foreground")
                    }
                  >
                    {saveLabel[saveStatus]}
                  </span>
                </div>
                <button
                  type="button"
                  aria-expanded={notesOpen}
                  onClick={() => setNotesOpen((open) => !open)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border/70 px-2.5 py-1.5 text-[11px] font-semibold text-foreground/80 transition hover:bg-primary/10 hover:text-foreground"
                >
                  {notesOpen ? (
                    <Check size={13} aria-hidden="true" />
                  ) : (
                    <Pencil size={13} aria-hidden="true" />
                  )}
                  {notesOpen ? "Done" : "Edit"}
                </button>
              </div>
              {noteRows.length ? (
                <dl className="mx-3 mb-3 overflow-hidden rounded-lg border border-border/70 divide-y divide-border/60">
                  {noteRows.map((row) => (
                    <div
                      key={row.label}
                      className="grid grid-cols-[minmax(84px,0.32fr)_minmax(0,1fr)] gap-2 px-2.5 py-2"
                    >
                      <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        {row.label}
                      </dt>
                      <dd className="whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground/90">
                        {row.value || "—"}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="px-3 pb-3 text-xs text-muted-foreground">
                  {notesReady
                    ? "No notes yet. Add tyre and battery strategy notes."
                    : "Loading notes…"}
                </p>
              )}
              {notesOpen && (
                <div className="border-t border-border/70 p-3">
                  <div className="mb-2 flex min-h-6 items-center justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground">
                      Notes save automatically.
                    </span>
                    {!notes && (
                      <button
                        type="button"
                        onClick={() => setNotes(notesTemplate)}
                        className="text-[11px] font-semibold text-primary hover:underline"
                      >
                        Insert strategy template
                      </button>
                    )}
                  </div>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={notesTemplate}
                    aria-label="Track notes"
                    className="h-36 max-h-56 min-h-28 w-full resize-y overflow-y-auto rounded-lg border border-border bg-background/70 p-3 font-mono text-sm leading-relaxed text-foreground outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
                  />
                </div>
              )}
            </section>
          </div>
        </section>

        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-white/70">
            <span className="h-3.5 w-[3px] rounded-full bg-red-500" />
            Sections
          </h2>
          <div className="flex items-center gap-2">
            {customizingLayout && (
              <span className="hidden text-[11px] text-muted-foreground sm:inline">
                Drag cards to reorder · changes save automatically
              </span>
            )}
            <button
              type="button"
              aria-pressed={customizingLayout}
              onClick={() => {
                setCustomizingLayout((active) => !active);
                setDragging(null);
              }}
              className={
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition " +
                (customizingLayout
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card/60 text-foreground/80 hover:border-primary/50 hover:bg-primary/10 hover:text-foreground")
              }
            >
              {customizingLayout ? (
                <Check size={14} aria-hidden="true" />
              ) : (
                <Pencil size={14} aria-hidden="true" />
              )}
              {customizingLayout ? "Done" : "Customize layout"}
            </button>
          </div>
        </div>
        <div className="mb-4 overflow-x-auto pb-1">
          <div
            className="grid min-w-[680px] grid-cols-4 gap-2"
            role="tablist"
            aria-label="Track sections"
            aria-orientation="horizontal"
          >
            {GROUPS.map((g) => {
              const Icon = g.icon;
              const active = group === g.id;
              return (
                <button
                  key={g.id}
                  role="tab"
                  aria-selected={active}
                  title={g.label}
                  onClick={() => pickGroup(g.id)}
                  className={
                    "flex min-w-0 items-center justify-between gap-2 rounded-xl border px-2.5 py-2.5 text-left transition " +
                    (active
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border/70 bg-card/40 text-muted-foreground hover:bg-card/80 hover:text-foreground")
                  }
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Icon
                      size={16}
                      strokeWidth={1.8}
                      className={active ? "shrink-0 text-primary-foreground" : "shrink-0"}
                      aria-hidden="true"
                    />
                    <span className="truncate text-xs font-semibold">{g.label}</span>
                  </span>
                  <span
                    className={
                      "rounded-md px-1.5 py-0.5 font-mono text-[10px] tabular-nums " +
                      (active
                        ? "bg-primary-foreground/15 text-primary-foreground"
                        : "bg-background/70 text-muted-foreground")
                    }
                  >
                    {g.views.length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div
          role="tabpanel"
          className={
            "grid grid-cols-1 gap-3 pb-2 sm:grid-cols-2 " +
            (useRaceCardGrid ? "lg:grid-cols-6" : "lg:grid-cols-3")
          }
        >
          {visibleOptions.map((o, index) => {
            const accent = ACCENTS[o.view] ?? "#ef3340";
            const Icon = o.icon;
            const raceCardSpan =
              useRaceCardGrid
                ? index < 2
                  ? "lg:col-span-3"
                  : "lg:col-span-2"
                : "";
            const linkProps =
              o.view === "teammate"
                ? {
                    to: "/season/$season/teammate" as const,
                    params: { season },
                    search: undefined as any,
                  }
                : o.view === "strategies"
                  ? {
                      to: "/season/$season/track/$track/strategies" as const,
                      params: { season, track },
                      search: { cat },
                    }
                  : {
                      to: "/season/$season/track/$track/$view" as const,
                      params: { season, track, view: o.view },
                      search: { cat },
                    };

            return (
              <div
                key={o.view}
                draggable={customizingLayout}
                aria-grabbed={customizingLayout && dragging === o.view}
                onDragStart={() => {
                  if (customizingLayout) setDragging(o.view);
                }}
                onDragEnd={() => setDragging(null)}
                onDragOver={(e) => {
                  if (customizingLayout) e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (customizingLayout && dragging) reorder(dragging, o.view);
                }}
                className={
                  "flex min-w-0 transition " +
                  raceCardSpan +
                  (dragging === o.view ? " opacity-40" : "")
                }
              >
                <Link
                  {...(linkProps as any)}
                  onClick={(event) => {
                    if (customizingLayout) event.preventDefault();
                  }}
                  style={{ ["--accent" as any]: accent }}
                  className={
                    "group relative flex h-full w-full items-start gap-3 overflow-hidden rounded-xl border border-border/70 bg-card/50 p-3 pl-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[color:var(--accent)] hover:bg-card hover:shadow-[0_10px_28px_-10px_var(--accent)] " +
                    (customizingLayout ? "cursor-grab active:cursor-grabbing" : "")
                  }
                >
                  <span
                    className="absolute inset-y-0 left-0 w-[3px] opacity-60 transition group-hover:opacity-100"
                    style={{ background: accent }}
                  />
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg transition group-hover:scale-105"
                    style={{
                      background: `color-mix(in oklab, ${accent} 14%, transparent)`,
                      boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${accent} 28%, transparent)`,
                    }}
                  >
                    <Icon size={18} strokeWidth={1.8} style={{ color: accent }} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-bold tracking-tight text-foreground">{o.label}</div>
                      {customizingLayout && (
                        <GripVertical
                          size={15}
                          className="mt-0.5 shrink-0 text-muted-foreground transition"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{o.desc}</div>
                    <TrackCardPreview view={o.view} data={cardPreview} />
                  </div>
                </Link>
              </div>
            );
          })}
        </div>

      </ShellPage>
    </>
  );
}

const TYRE_COMPOUND_COLORS: Record<string, string> = {
  soft: "#ef4444",
  medium: "#facc15",
  hard: "#e5e7eb",
  intermediate: "#22c55e",
  wet: "#3b82f6",
};

function TrackCardPreview({ view, data }: { view: string; data: TrackCardPreviewData }) {
  if (view === "race-story") {
    const positionChange = data.positions
      ? data.positions.start - data.positions.finish
      : null;
    return (
      <div className="mt-2 space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-[10px]">
          <span className="font-semibold text-foreground/90">
            {data.positions
              ? `P${data.positions.start} → P${data.positions.finish}`
              : "No position history"}
          </span>
          {positionChange !== null && positionChange !== 0 && (
            <span className="text-muted-foreground">
              {positionChange > 0 ? `+${positionChange}` : positionChange} places
            </span>
          )}
        </div>
        {data.stints.length > 0 ? (
          <>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-muted/60" aria-label="Tyre stints">
              {data.stints.map((stint, index) => (
                <span
                  key={`${stint.compound}-${stint.startLap}-${index}`}
                  title={`${stint.compound}, laps ${stint.startLap}–${stint.endLap}`}
                  className="min-w-1 border-r border-background/50 last:border-r-0"
                  style={{
                    flex: `${Math.max(stint.laps, 1)} 1 0%`,
                    backgroundColor: TYRE_COMPOUND_COLORS[stint.compound.toLowerCase()] ?? "#94a3b8",
                  }}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-2 text-[9px] text-muted-foreground">
              {data.stints.map((stint, index) => (
                <span key={`${stint.compound}-${stint.startLap}-label-${index}`}>
                  {stint.compound}{stint.laps ? ` · L${stint.startLap}–${stint.endLap}` : ""}
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="text-[10px] text-muted-foreground">No tyre-stint data recorded</p>
        )}
      </div>
    );
  }

  if (view === "ai-debrief") {
    const delta = data.medianPaceDeltaMs;
    return (
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
        {data.laps.length > 0 && (
          <span className="font-semibold text-foreground/90">{data.laps.length} timed laps</span>
        )}
        {delta !== null ? (
          <span className="text-muted-foreground">
            Median vs field{" "}
            <strong className="font-mono text-foreground">
              {delta > 0 ? "+" : ""}{(delta / 1000).toFixed(2)}s
            </strong>
          </span>
        ) : data.laps.length === 0 ? (
          <span className="text-muted-foreground">No race-pace telemetry available</span>
        ) : null}
      </div>
    );
  }

  if (view === "compare") {
    if (data.bestLapMs === null) {
      return <p className="mt-2 text-[10px] text-muted-foreground">No lap-time comparison available</p>;
    }
    const gap = data.fastestRival ? data.bestLapMs - data.fastestRival.ms : null;
    return (
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[10px]">
        <span className="text-muted-foreground">
          Best <strong className="font-mono text-foreground">{formatPreviewLapTime(data.bestLapMs)}</strong>
        </span>
        {gap !== null ? (
          <span className="font-mono font-semibold text-foreground/90">
            {gap > 0 ? "+" : ""}{(gap / 1000).toFixed(3)}s vs {data.fastestRival?.name}
          </span>
        ) : (
          <span className="text-muted-foreground">No rival lap data</span>
        )}
      </div>
    );
  }

  if (view === "graphs") {
    if (data.laps.length < 2) {
      return <p className="mt-2 text-[10px] text-muted-foreground">Not enough lap times for a trend</p>;
    }
    const times = data.laps.map((lap) => lap.ms);
    const min = Math.min(...times);
    const max = Math.max(...times);
    const points = times
      .map((time, index) => {
        const x = (index / (times.length - 1)) * 100;
        const y = max === min ? 11 : 3 + ((max - time) / (max - min)) * 16;
        return `${x},${y}`;
      })
      .join(" ");
    return (
      <div className="mt-2 flex items-center gap-2">
        <svg
          viewBox="0 0 100 22"
          preserveAspectRatio="none"
          role="img"
          aria-label={`Lap-time trend from ${times.length} recorded laps`}
          className="h-7 min-w-0 flex-1 overflow-visible"
        >
          <polyline
            points={points}
            fill="none"
            stroke="#4bf09a"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground">{times.length} laps</span>
      </div>
    );
  }

  if (view === "data") {
    return data.bestLapMs !== null && data.averageLapMs !== null ? (
      <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
        <div>
          <div className="text-muted-foreground">Best</div>
          <div className="font-mono font-semibold text-foreground">{formatPreviewLapTime(data.bestLapMs)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Average</div>
          <div className="font-mono font-semibold text-foreground">{formatPreviewLapTime(data.averageLapMs)}</div>
        </div>
      </div>
    ) : (
      <p className="mt-2 text-[10px] text-muted-foreground">No lap-time summary available</p>
    );
  }

  return null;
}

function NavBar({
  center,
  prev,
  next,
}: {
  center: string;
  prev: React.ReactNode;
  next: React.ReactNode;
}) {
  return (
    <div className="flex w-full min-w-0 items-center rounded-xl border border-border/70 bg-card/50 p-1">
      <div className="flex min-w-0 flex-1 items-center justify-between gap-1">
        {prev ?? <span className="flex-1" />}
        <span className="flex shrink-0 items-center whitespace-nowrap rounded-lg bg-background/70 px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground sm:px-2.5">
          {center}
        </span>
        {next ?? <span className="flex-1" />}
      </div>
    </div>
  );
}

function NavLink({
  dir,
  label,
  ...rest
}: {
  dir: "prev" | "next";
  label: string;
  to: any;
  params: any;
  search: any;
}) {
  return (
    <Link
      {...(rest as any)}
      title={label}
      aria-label={`${dir === "prev" ? "Previous" : "Next"}: ${label}`}
      className="group flex min-w-0 max-w-[45%] flex-1 items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-foreground/80 transition hover:bg-primary/10 hover:text-foreground sm:px-2.5"
    >
      {dir === "prev" && <ChevronLeft size={14} className="shrink-0 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />}
      <span className="truncate">{label}</span>
      {dir === "next" && <ChevronRight size={14} className="shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />}
    </Link>
  );
}

function sessionLabel(s: Session) {
  const st = String(s.session_type || "").trim();
  return st && st.toLowerCase() !== String(s.category || "").toLowerCase()
    ? `${s.category} · ${st}`
    : s.category;
}

function UploadedSessions({
  sessions,
  onDeleted,
}: {
  sessions: Session[];
  onDeleted: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!sessions.length) return null;
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime(),
  );

  async function remove(s: Session) {
    if (!confirm(`Delete only "${sessionLabel(s)}" from this weekend? This cannot be undone.`)) return;
    setBusy(s.id);
    setError(null);
    const { error } = await supabase.from("telemetry_sessions").delete().eq("id", s.id);
    setBusy(null);
    if (error) setError(error.message);
    else onDeleted(s.id);
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border/70 bg-card/40">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-card/70"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Database size={16} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <span className="truncate text-xs font-bold uppercase tracking-wider text-foreground">
            Uploaded sessions
          </span>
          <span className="rounded-full bg-background/80 px-2 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-muted-foreground">
            {sessions.length}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-muted-foreground">
          {open ? "Hide" : "Manage"}
          <ChevronDown
            size={14}
            className={"transition-transform " + (open ? "rotate-180" : "")}
            aria-hidden="true"
          />
        </span>
      </button>
      {open && (
        <ul className="divide-y divide-border/60 border-t border-border/70">
          {sorted.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-foreground">{sessionLabel(s)}</div>
                <div className="text-[10px] text-muted-foreground">
                  {s.created_at ? new Date(s.created_at).toLocaleString() : ""}
                  {s.finishing_position ? ` · P${s.finishing_position}` : ""}
                </div>
              </div>
              <button
                type="button"
                disabled={busy === s.id}
                onClick={() => remove(s)}
                className="rounded-lg border border-destructive/35 px-2.5 py-1 text-[11px] font-semibold text-destructive transition hover:bg-destructive/10 disabled:opacity-50"
              >
                {busy === s.id ? "Deleting…" : "Delete"}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="px-3 pb-2.5 text-xs text-destructive">{error}</p>}
    </section>
  );
}
