import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  EXTRA_TRACKS,
  fetchSessions,
  loadCachedSessions,
  trackFlag,
  type Session,
} from "@/lib/f1-shell";
import {
  computeTitleMath,
  loadExcludedTracks,
  loadExtraTracks,
  loadSprintWeekends,
  saveExcludedTracks,
  saveExtraTracks,
  saveSprintWeekends,
} from "@/lib/f1-stats";

const EXTRA_NAMES: Record<string, string> = Object.fromEntries(EXTRA_TRACKS.map((t) => [t.slug, t.name]));
import { ShellHeader, ShellPage } from "@/components/f1/ShellHeader";

export const Route = createFileRoute("/season/$season/title")({
  head: () => ({
    meta: [
      { title: "Title Race · F1 Telemetry Analyzer" },
      { name: "description", content: "Championship permutations: points needed per remaining race to win the title." },
      { property: "og:title", content: "Title Race · F1 Telemetry Analyzer" },
      { property: "og:description", content: "Championship permutations: points needed per remaining race to win the title." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TitlePage,
});

function TitlePage() {
  const { season } = Route.useParams();
  const seasonN = Number(season);
  const cached = typeof window !== "undefined" ? loadCachedSessions() : null;
  const [sessions, setSessions] = useState<Session[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);
  const [err, setErr] = useState<string | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(() =>
    typeof window !== "undefined" ? loadExcludedTracks(seasonN) : new Set(),
  );
  const [sprints, setSprints] = useState<Set<string>>(() =>
    typeof window !== "undefined" ? loadSprintWeekends(seasonN) : new Set(),
  );
  const [extras, setExtras] = useState<Set<string>>(() =>
    typeof window !== "undefined" ? loadExtraTracks(seasonN) : new Set(),
  );
  const [showCalendar, setShowCalendar] = useState(false);

  // Each season keeps its own calendar, sprint weekends and added tracks.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setExcluded(loadExcludedTracks(seasonN));
    setSprints(loadSprintWeekends(seasonN));
    setExtras(loadExtraTracks(seasonN));
  }, [seasonN]);

  const toggleSprint = (slug: string) => {
    setSprints((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      saveSprintWeekends(next, seasonN);
      return next;
    });
  };
  const setExtra = (slug: string, on: boolean) => {
    setExtras((prev) => {
      const next = new Set(prev);
      if (on) next.add(slug);
      else next.delete(slug);
      saveExtraTracks(next, seasonN);
      return next;
    });
  };

  const toggleTrack = (slug: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      saveExcludedTracks(next, seasonN);
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;
    fetchSessions()
      .then((rows) => { if (!cancelled) setSessions(rows); })
      .catch((e) => { if (!cancelled) setErr(String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const math = useMemo(
    () => computeTitleMath(sessions, seasonN, { excluded, sprints, extras, extraNames: EXTRA_NAMES }),
    [sessions, seasonN, excluded, sprints, extras],
  );
  const { standings, player, leader, remaining, racesLeft, sprintsLeft, maxPointsLeft, rounds } = math;
  const roundBySlug = new Map(rounds.map((r) => [r.slug, r]));
  const addable = EXTRA_TRACKS.filter((t) => !roundBySlug.has(t.slug));
  const isPlayerLeader = !!player && !!leader && player.name === leader.name;
  const gapToLeader = player && leader ? leader.points - player.points : 0;
  // Points per remaining race a driver needs to outscore the leader by.
  const perRaceNeeded = (pts: number) =>
    leader && racesLeft > 0 ? Math.max(0, (leader.points - pts + 1) / racesLeft) : 0;
  // Player can still win if perfect remaining season beats the leader's current total.
  const canStillWin = !!player && !!leader && player.points + maxPointsLeft >= leader.points + 1;
  // Points the leader needs across the rest of the season so that even P2 winning
  // everything left can't catch them (tiebreak ignored, +1 for safety).
  const p2 = standings.find((d) => d.name !== leader?.name) ?? null;
  const magicNumber =
    isPlayerLeader && p2 ? Math.max(0, p2.points + maxPointsLeft + 1 - (leader?.points ?? 0)) : null;

  return (
    <>
      <ShellHeader
        crumbs={[{ label: `Season ${season}`, to: "/" }, { label: "Title Race" }]}
      />
      <ShellPage>
        <div className="mb-5">
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">🏆 Title Race · Season {season}</h1>
          <p className="mt-1 text-sm text-white/50">
            Championship permutations based on your uploaded races.
          </p>
        </div>

        {loading && <div className="text-white/50">Loading sessions…</div>}
        {err && <div className="text-red-400">Failed to load: {err}</div>}
        {!loading && standings.length === 0 && (
          <div className="rounded-lg border border-dashed border-white/15 p-8 text-center text-white/50">
            No race results for Season {season} yet.
          </div>
        )}

        {standings.length > 0 && (
          <>
            <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <HeroStat label="Leader" value={leader?.name ?? "—"} sub={`${leader?.points ?? 0} pts`} />
              <HeroStat
                label={isPlayerLeader ? "Your lead" : "Your gap"}
                value={player ? (isPlayerLeader ? `+${leader!.points - (standings[1]?.points ?? 0)}` : `−${gapToLeader}`) : "—"}
                sub={player ? `${player.points} pts · P${standings.findIndex((d) => d.name === player.name) + 1}` : "no points yet"}
                accent={isPlayerLeader ? "text-emerald-400" : "text-red-400"}
              />
              <HeroStat
                label="Races left"
                value={sprintsLeft > 0 ? `${racesLeft} + ${sprintsLeft} spr` : String(racesLeft)}
                sub={`max ${maxPointsLeft} pts available`}
              />
              <HeroStat
                label={isPlayerLeader ? "Magic number" : "Verdict"}
                value={!player ? "—" : isPlayerLeader ? (magicNumber != null && magicNumber > 0 ? String(magicNumber) : "Clinched 🏆") : canStillWin ? "Alive 💪" : "Eliminated"}
                sub={
                  !player
                    ? "you're not in the results yet"
                    : isPlayerLeader
                    ? magicNumber != null && magicNumber > 0
                      ? "pts to secure the title"
                      : "title is yours"
                    : canStillWin
                      ? "you can still win"
                      : "out of contention"
                }
                accent={!player ? "text-white/60" : isPlayerLeader ? "text-emerald-400" : canStillWin ? "text-amber-300" : "text-red-400"}
              />
            </div>

            <div className="mb-6 overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.04] text-left text-[10px] uppercase tracking-widest text-white/50">
                    <th className="px-3 py-2.5">#</th>
                    <th className="px-3 py-2.5">Driver</th>
                    <th className="px-3 py-2.5">Team</th>
                    <th className="px-3 py-2.5 text-right">Pts</th>
                    <th className="px-3 py-2.5 text-right">Gap</th>
                    <th className="px-3 py-2.5 text-right">Needs / race</th>
                    <th className="px-3 py-2.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.slice(0, 8).map((d, i) => {
                    const isPlayerRow = d.name === player?.name;
                    const needed = perRaceNeeded(d.points);
                    const alive = d.points + maxPointsLeft >= (leader?.points ?? 0) + 1;
                    return (
                      <tr
                        key={d.name}
                        className={
                          "border-b border-white/5 " +
                          (isPlayerRow ? "bg-red-500/10" : i % 2 ? "bg-white/[0.02]" : "")
                        }
                      >
                        <td className="px-3 py-2 font-bold text-white/60">{i + 1}</td>
                        <td className="px-3 py-2 font-bold">
                          {d.name}
                          {isPlayerRow && <span className="ml-2 rounded-sm bg-red-500 px-1.5 py-0.5 text-[9px] font-black uppercase">You</span>}
                        </td>
                        <td className="px-3 py-2 text-white/60">{d.team || "—"}</td>
                        <td className="px-3 py-2 text-right font-black">{d.points}</td>
                        <td className="px-3 py-2 text-right text-white/60">
                          {i === 0 ? "—" : `−${leader!.points - d.points}`}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {i === 0 ? "—" : racesLeft > 0 ? needed.toFixed(1) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {i === 0 ? (
                            <span className="text-emerald-400">Leading</span>
                          ) : alive ? (
                            <span className="text-amber-300">Alive</span>
                          ) : (
                            <span className="text-white/40">Out</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-xs font-bold uppercase tracking-widest text-white/60">
                  Remaining races ({racesLeft})
                </h2>
                <button
                  type="button"
                  onClick={() => setShowCalendar((v) => !v)}
                  className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-bold text-white/70 hover:bg-white/10 hover:text-white"
                >
                  {showCalendar ? "Hide calendar" : "Edit calendar"}
                </button>
              </div>
              {showCalendar && (
                <div className="mb-3 rounded-md border border-white/10 bg-black/30 p-3">
                  <p className="mb-2 text-[11px] leading-relaxed text-white/45">
                    Tap a track to include or skip it. Tap <b>Sprint</b> to mark a sprint weekend. Rounds you've
                    already driven are numbered in the order you drove them.
                  </p>
                  <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                    {rounds.map((r) => {
                      const active = !excluded.has(r.slug);
                      const isExtra = extras.has(r.slug) && r.round == null;
                      return (
                        <li
                          key={r.slug}
                          className={
                            "flex items-center gap-1 rounded-md border px-1.5 py-1 " +
                            (active ? "border-emerald-500/30 bg-emerald-500/10" : "border-white/10 bg-white/[0.03]")
                          }
                        >
                          <button
                            type="button"
                            onClick={() => toggleTrack(r.slug)}
                            aria-pressed={active}
                            className={
                              "flex min-w-0 flex-1 items-center gap-1.5 px-1 py-0.5 text-left text-[11px] font-semibold " +
                              (active ? "text-white" : "text-white/35 line-through")
                            }
                          >
                            <span className="w-6 shrink-0 font-mono text-[10px] text-white/45">
                              {r.round != null ? `R${r.round}` : "—"}
                            </span>
                            <span>{trackFlag(r.slug)}</span>
                            <span className="truncate">{r.name}</span>
                            {r.done && <span className="text-emerald-400" title="Race uploaded">✓</span>}
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleSprint(r.slug)}
                            disabled={r.sprintDone}
                            aria-pressed={r.sprint}
                            title={r.sprintDone ? "Sprint uploaded" : r.sprint ? "Sprint weekend — tap to remove" : "Mark as sprint weekend"}
                            className={
                              "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider " +
                              (r.sprint ? "bg-amber-400/20 text-amber-300" : "text-white/30 hover:bg-white/10 hover:text-white/60")
                            }
                          >
                            Sprint
                          </button>
                          {isExtra && (
                            <button
                              type="button"
                              onClick={() => setExtra(r.slug, false)}
                              aria-label={`Remove ${r.name} from calendar`}
                              className="shrink-0 rounded px-1 text-xs text-white/40 hover:bg-white/10 hover:text-white"
                            >
                              ✕
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {addable.length > 0 && (
                    <label className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-white/60">
                      <span className="font-bold uppercase tracking-widest">Add modded track</span>
                      <select
                        value=""
                        onChange={(e) => e.target.value && setExtra(e.target.value, true)}
                        className="rounded-md border border-white/15 bg-black/60 px-2 py-1 text-[11px] text-white"
                      >
                        <option value="">Choose…</option>
                        {addable.map((t) => (
                          <option key={t.slug} value={t.slug}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              )}
              {racesLeft === 0 ? (
                <p className="text-sm text-white/50">Season complete — all calendar races uploaded.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {remaining.map((t) => (
                    <span
                      key={t.slug}
                      className="flex items-center gap-1.5 rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs font-semibold"
                    >
                      <span>{trackFlag(t.slug)}</span>
                      {t.name}
                      {roundBySlug.get(t.slug)?.sprint && !roundBySlug.get(t.slug)?.sprintDone && (
                        <span className="rounded bg-amber-400/20 px-1 text-[9px] font-black uppercase text-amber-300">Sprint</span>
                      )}
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-3 text-[11px] leading-relaxed text-white/40">
                “Needs / race” is the average points per remaining race required to pass the leader.
                Max available assumes 25 per Grand Prix (win, no fastest-lap point) plus 8 per sprint weekend still to run.
                Modded tracks you drive join the calendar automatically, numbered in the order you raced them.
              </p>
            </div>

            <div className="mt-4">
              <Link to="/" className="text-xs font-semibold text-white/60 hover:text-white">
                ← Back to Season {season}
              </Link>
            </div>
          </>
        )}
      </ShellPage>
    </>
  );
}

function HeroStat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-3">
      <div className="text-[10px] uppercase tracking-widest text-white/50">{label}</div>
      <div className={"mt-1 truncate text-lg font-black sm:text-xl " + (accent ?? "")}>{value}</div>
      {sub && <div className="mt-0.5 truncate text-[10px] text-white/40">{sub}</div>}
    </div>
  );
}
