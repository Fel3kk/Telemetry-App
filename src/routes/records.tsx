import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  fetchSessions,
  loadCachedSessions,
  titleCaseTrack,
  trackFlag,
  type Session,
} from "@/lib/f1-shell";
import {
  allTimeConstructorProfiles,
  allTimeDriverProfiles,
  computeConstructorStandings,
  computeStandings,
  computeTitleMath,
  driverTeamHistories,
  formatLapMs,
  hasClinchedTitle,
  loadExcludedTracks,
  loadExtraTracks,
  loadSprintWeekends,
  personalRecords,
  sortRecords,
  type RecordSortKey,
} from "@/lib/f1-stats";
import { ShellHeader, ShellPage } from "@/components/f1/ShellHeader";
import { DriverProfileDialog, type DriverProfile } from "@/components/f1/DriverProfileDialog";
import { DriverProfileTiles, type DriverTileProfile } from "@/components/f1/DriverProfileTiles";
import { ConstructorProfileTiles } from "@/components/f1/ConstructorProfileTiles";
import { DriverTeamHistory } from "@/components/f1/DriverTeamHistory";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/records")({
  head: () => ({
    meta: [
      { title: "Personal Records · F1 Telemetry Analyzer" },
      { name: "description", content: "Your fastest lap on every track across all seasons." },
      { property: "og:title", content: "Personal Records · F1 Telemetry Analyzer" },
      {
        property: "og:description",
        content: "Your fastest lap on every track across all seasons.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
      .then((rows) => {
        if (!cancelled) setSessions(rows);
      })
      .catch((e) => {
        if (!cancelled) setErr(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [sortBy, setSortBy] = useState<RecordSortKey>("round");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [selectedDriver, setSelectedDriver] = useState<DriverProfile | null>(null);
  const [profileContext, setProfileContext] = useState("All-Time Stats");
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
    try {
      localStorage.setItem(SORT_KEY, k);
    } catch {
      /* ignore */
    }
  };
  const saveOpen = (next: Set<string>) => {
    setOpen(next);
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
  };
  const toggle = (slug: string) => {
    const next = new Set(open);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    saveOpen(next);
  };

  const allRecords = useMemo(() => personalRecords(sessions), [sessions]);
  const records = useMemo(() => sortRecords(allRecords, sortBy), [allRecords, sortBy]);
  const allTimeDrivers = useMemo(() => {
    const seasons = [...new Set(sessions.map((s) => Number(s.season)).filter(Number.isFinite))];
    const currentSeason = Math.max(0, ...seasons);
    const titles = new Map<string, number>();

    for (const season of seasons) {
      const seasonStandings = computeStandings(
        sessions.filter((session) => Number(session.season) === season),
      );
      const leader = seasonStandings[0];
      if (!leader || leader.points <= 0) continue;

      let titleIsFinal = season !== currentSeason;
      if (!titleIsFinal) {
        const titleMath = computeTitleMath(sessions, season, {
          excluded: loadExcludedTracks(season),
          sprints: loadSprintWeekends(season),
          extras: loadExtraTracks(season),
        });
        titleIsFinal = hasClinchedTitle(titleMath.standings, titleMath.maxPointsLeft);
      }
      if (titleIsFinal) titles.set(leader.name, (titles.get(leader.name) ?? 0) + 1);
    }

    return allTimeDriverProfiles(sessions, titles);
  }, [sessions]);
  const allTimeConstructors = useMemo(() => {
    const seasons = [
      ...new Set(sessions.map((session) => Number(session.season)).filter(Number.isFinite)),
    ];
    const currentSeason = Math.max(0, ...seasons);
    const titles = new Map<string, number>();

    for (const season of seasons) {
      const standings = computeConstructorStandings(
        sessions.filter((session) => Number(session.season) === season),
      );
      const leader = standings[0];
      if (!leader || leader.points <= 0) continue;

      let titleIsFinal = season !== currentSeason;
      if (!titleIsFinal) {
        const titleMath = computeTitleMath(sessions, season, {
          excluded: loadExcludedTracks(season),
          sprints: loadSprintWeekends(season),
          extras: loadExtraTracks(season),
        });
        const maxConstructorPointsLeft = titleMath.racesLeft * 43 + titleMath.sprintsLeft * 15;
        titleIsFinal = hasClinchedTitle(standings, maxConstructorPointsLeft);
      }
      if (titleIsFinal) titles.set(leader.team, (titles.get(leader.team) ?? 0) + 1);
    }

    return allTimeConstructorProfiles(sessions, titles);
  }, [sessions]);
  const teamHistories = useMemo(() => driverTeamHistories(sessions), [sessions]);
  const selectDriver = (driver: DriverTileProfile, context: string) => {
    setSelectedDriver({
      name: driver.name,
      team: driver.team,
      stats: driver.stats,
      imageSrc: driver.imageSrc,
      titles: driver.titles,
      seasonsActive: driver.seasonsActive,
    });
    setProfileContext(context);
  };
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
              Explore lap records, career stats, and driver team history across seasons.
            </p>
          </div>
        </div>

        {loading && <div className="text-white/50">Loading sessions…</div>}
        {err && <div className="text-red-400">Failed to load: {err}</div>}
        <Tabs defaultValue="laps" className="space-y-3">
          <TabsList
            aria-label="All-time record categories"
            className="grid h-auto w-full grid-cols-2 gap-2 bg-transparent p-0 sm:grid-cols-4"
          >
            <TabsTrigger
              value="laps"
              className="h-full min-h-20 flex-col items-start justify-start gap-1 whitespace-normal rounded-xl border border-border/70 bg-card/50 px-3 py-3 text-left data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <span className="font-bold">Lap Time Records</span>
              <span className="text-[10px] text-muted-foreground">
                {records.length} {records.length === 1 ? "track" : "tracks"}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="teams"
              className="h-full min-h-20 flex-col items-start justify-start gap-1 whitespace-normal rounded-xl border border-border/70 bg-card/50 px-3 py-3 text-left data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <span className="font-bold">Team Stats</span>
              <span className="text-[10px] text-muted-foreground">
                {allTimeConstructors.length} {allTimeConstructors.length === 1 ? "team" : "teams"}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="drivers"
              className="h-full min-h-20 flex-col items-start justify-start gap-1 whitespace-normal rounded-xl border border-border/70 bg-card/50 px-3 py-3 text-left data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <span className="font-bold">Driver Stats</span>
              <span className="text-[10px] text-muted-foreground">
                {allTimeDrivers.length} {allTimeDrivers.length === 1 ? "driver" : "drivers"}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="moves"
              className="h-full min-h-20 flex-col items-start justify-start gap-1 whitespace-normal rounded-xl border border-border/70 bg-card/50 px-3 py-3 text-left data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <span className="font-bold">Driver Moves</span>
              <span className="text-[10px] text-muted-foreground">
                {teamHistories.length}{" "}
                {teamHistories.length === 1 ? "driver history" : "driver histories"}
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="laps" className="mt-0">
            <section className="overflow-hidden rounded-xl border border-border/70 bg-card/50">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/70 px-3 py-3">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-widest text-white/80">
                    Lap Time Records
                  </h2>
                  <p className="mt-1 text-xs text-white/45">
                    Personal bests for each track, with season-by-season improvements.
                  </p>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <Stat label="Tracks" value={records.length} />
                  <Stat label="Total found" value={`${(totalImprovement / 1000).toFixed(1)}s`} />
                  {records.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          saveOpen(allOpen ? new Set() : new Set(records.map((r) => r.slug)))
                        }
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
                          {SORTS.map((option) => (
                            <option key={option.key} value={option.key}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  )}
                </div>
              </div>
              {!loading && records.length === 0 && (
                <div className="m-3 rounded-lg border border-dashed border-white/15 p-8 text-center text-white/50">
                  No laps recorded yet. Upload race or qualifying sessions to build your records
                  wall.
                </div>
              )}

              <div className="grid grid-cols-1 items-start gap-2 px-3 py-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {records.map((r) => {
                  const delta = r.secondBestMs ? r.secondBestMs - r.bestMs : null;
                  const isOpen = open.has(r.slug);
                  return (
                    <div
                      key={r.slug}
                      className={`rounded-lg border bg-white/[0.03] transition-colors duration-300 ${isOpen ? "border-purple-400/40" : "border-white/10 hover:border-purple-400/40"}`}
                    >
                      <button
                        type="button"
                        onClick={() => toggle(r.slug)}
                        aria-expanded={isOpen}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
                      >
                        <span className="text-lg leading-none">{trackFlag(r.track)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold">
                            {titleCaseTrack(r.track)}
                          </span>
                          <span className="flex items-center gap-2 text-[11px]">
                            <span className="font-mono font-black text-purple-300">
                              {formatLapMs(r.bestMs)}
                            </span>
                            {delta != null && delta > 0 && (
                              <span className="font-mono font-semibold text-emerald-400">
                                −{(delta / 1000).toFixed(3)}
                              </span>
                            )}
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
                                {delta != null && delta > 0
                                  ? ` · −${(delta / 1000).toFixed(3)}s vs next best`
                                  : ""}
                              </span>
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
                                      <span className="truncate text-white/50">
                                        {s.team || "—"}
                                      </span>
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
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </TabsContent>

          <TabsContent value="teams" className="mt-0">
            <section className="overflow-hidden rounded-xl border border-border/70 bg-card/50">
              <div className="border-b border-border/70 px-3 py-3">
                <h2 className="text-sm font-bold uppercase tracking-widest text-white/80">
                  Team All-Time Stats
                </h2>
                <p className="mt-1 text-xs text-white/45">
                  Points, wins, podiums, poles, and titles aggregated across seasons.
                </p>
              </div>
              {allTimeConstructors.length ? (
                <ConstructorProfileTiles constructors={allTimeConstructors} />
              ) : (
                <p className="px-3 py-4 text-sm text-white/45">No team standings yet.</p>
              )}
            </section>
          </TabsContent>

          <TabsContent value="drivers" className="mt-0">
            <section className="overflow-hidden rounded-xl border border-border/70 bg-card/50">
              <div className="border-b border-border/70 px-3 py-3">
                <h2 className="text-sm font-bold uppercase tracking-widest text-white/80">
                  Driver All-Time Stats
                </h2>
                <p className="mt-1 text-xs text-white/45">
                  Select a driver for their career profile or compare any two drivers. Titles count
                  only after a season is complete or mathematically clinched.
                </p>
              </div>
              {allTimeDrivers.length ? (
                <DriverProfileTiles
                  drivers={allTimeDrivers}
                  teamHistories={teamHistories}
                  onSelect={(driver) => selectDriver(driver, "All-Time Stats")}
                />
              ) : (
                <p className="px-3 py-4 text-sm text-white/45">No driver standings yet.</p>
              )}
            </section>
          </TabsContent>

          <TabsContent value="moves" className="mt-0">
            <section className="overflow-hidden rounded-xl border border-border/70 bg-card/50">
              <div className="border-b border-border/70 px-3 py-3">
                <h2 className="text-sm font-bold uppercase tracking-widest text-white/80">
                  Driver Moves &amp; Team History
                </h2>
                <p className="mt-1 text-xs text-white/45">
                  Choose a driver to see their team assignment for each season.
                </p>
              </div>
              <div className="py-3">
                <DriverTeamHistory histories={teamHistories} />
              </div>
            </section>
          </TabsContent>
        </Tabs>

        <DriverProfileDialog
          driver={selectedDriver}
          context={profileContext}
          onClose={() => setSelectedDriver(null)}
        />
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
