import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/lib/supabase";
import { getActiveCareer } from "@/lib/career";
import { trackSlug } from "@/lib/f1-shell";
import { buildDebriefFacts } from "@/lib/race-debrief";
import { fetchDebriefSessions, type DebriefSessionRow } from "@/lib/debrief-sessions";
import { Button } from "@/components/ui/button";
import { generateDebrief, type Debrief } from "@/lib/ai-debrief.functions";

type QA = { q: string; a: string };
type LocalSessionSnapshot = {
  season: number;
  career: string | null;
  track_name: string;
  category: string;
  session_type?: string | null;
  driver_name?: string;
  starting_position?: number | null;
  finishing_position?: number | null;
  created_at?: string;
};
type CachedDebrief = {
  debrief?: Debrief | null;
  qa?: QA[];
  session?: LocalSessionSnapshot;
  savedAt?: string;
};
type Row = DebriefSessionRow & { localOnly?: boolean };

const CACHE_PREFIX = "f1.debrief.v1.";
const cacheKey = (id: string) => `${CACHE_PREFIX}${id}`;
const seconds = (value: number | null | undefined) =>
  typeof value === "number" ? `${value.toFixed(3)}s` : "—";
const signedSeconds = (value: number | null | undefined) =>
  typeof value === "number" ? `${value > 0 ? "+" : ""}${value.toFixed(3)}s` : "—";

function localSessionSnapshot(
  session: Row,
  season: number,
  career: string | null,
): LocalSessionSnapshot {
  return {
    season,
    career,
    track_name: session.track_name,
    category: session.category,
    session_type: session.session_type,
    driver_name: session.driver_name,
    starting_position: session.starting_position,
    finishing_position: session.finishing_position,
    created_at: session.created_at,
  };
}

function readLocalDebriefSessions(options: {
  season: number;
  track: string;
  cat: string;
  career: string | null;
}): Row[] {
  const rows: Row[] = [];
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key?.startsWith(CACHE_PREFIX)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      let cached: CachedDebrief;
      try {
        cached = JSON.parse(raw) as CachedDebrief;
      } catch (error) {
        console.warn("Skipping an unreadable local AI debrief.", error);
        continue;
      }

      if (!cached || typeof cached !== "object" || Array.isArray(cached)) {
        continue;
      }
      const metadata = cached.session;
      if (
        !cached.debrief ||
        !metadata ||
        Number(metadata.season) !== options.season ||
        metadata.career !== options.career ||
        trackSlug(metadata.track_name) !== trackSlug(options.track)
      ) {
        continue;
      }
      const isSprint = /sprint|shootout/i.test(
        `${metadata.category} ${metadata.session_type ?? ""}`,
      );
      if (options.cat === "Sprint" ? !isSprint : isSprint) continue;

      const id = key.slice(CACHE_PREFIX.length);
      if (!id) continue;
      rows.push({
        ...metadata,
        id,
        lap_history: [],
        localOnly: true,
      });
    }
  } catch (error) {
    console.warn("Unable to read locally saved AI debriefs.", error);
  }
  return rows.sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
}

function attachSessionMetadata(rows: DebriefSessionRow[], season: number, career: string | null) {
  rows.forEach((session) => {
    try {
      const key = cacheKey(session.id);
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const cached = JSON.parse(raw) as CachedDebrief;
      if (!cached.debrief || cached.session) return;
      localStorage.setItem(
        key,
        JSON.stringify({
          ...cached,
          session: localSessionSnapshot(session, season, career),
          savedAt: new Date().toISOString(),
        }),
      );
    } catch (error) {
      console.warn("Unable to add session details to a saved AI debrief.", error);
    }
  });
}

export function AiDebrief({
  season,
  track,
  cat = "Race",
}: {
  season: number;
  track: string;
  cat?: string;
}) {
  const run = useServerFn(generateDebrief);
  const [sessions, setSessions] = useState<Row[]>([]);
  const [selected, setSelected] = useState("");
  const [status, setStatus] = useState("Loading sessions…");
  const [loadFailed, setLoadFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [debrief, setDebrief] = useState<Debrief | null>(null);
  const [savedLocally, setSavedLocally] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [qa, setQa] = useState<QA[]>([]);
  const [question, setQuestion] = useState("");

  useEffect(() => {
    let active = true;
    setStatus("Loading sessions…");
    setLoadFailed(false);
    setSessions([]);
    setSelected("");
    const career = getActiveCareer();
    const localRows = readLocalDebriefSessions({
      season,
      track,
      cat,
      career,
    });
    (async () => {
      try {
        const rows = await fetchDebriefSessions(supabase, { season, track, cat, career });
        if (!active) return;
        attachSessionMetadata(rows, season, career);
        const cachedRows = readLocalDebriefSessions({
          season,
          track,
          cat,
          career,
        });
        const serverIds = new Set(rows.map((row) => row.id));
        const combinedRows = [...rows, ...cachedRows.filter((row) => !serverIds.has(row.id))];
        setSessions(combinedRows);
        setSelected(rows[0]?.id ?? combinedRows[0]?.id ?? "");
        setStatus(
          rows.length
            ? ""
            : cachedRows.length
              ? "Showing debriefs saved on this device. Session data is unavailable for new analysis."
              : "No sessions uploaded for this weekend yet.",
        );
      } catch (loadError) {
        console.error("Unable to load sessions for the AI debrief.", loadError);
        if (active) {
          setSessions(localRows);
          setSelected(localRows[0]?.id ?? "");
          setLoadFailed(true);
          setStatus(
            localRows.length
              ? "Sessions couldn't be loaded. Showing debriefs saved on this device; reconnect to analyze or ask follow-up questions."
              : "Saved sessions couldn't be loaded. Check your connection and try again.",
          );
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [season, track, cat, reload]);

  const session = sessions.find((s) => s.id === selected);
  const facts = useMemo(
    () => (session && !session.localOnly ? buildDebriefFacts(session) : null),
    [session],
  );

  useEffect(() => {
    setError("");
    setSaveError("");
    setSavedLocally(false);
    setQa([]);
    setDebrief(null);
    if (!selected) return;
    try {
      const raw = localStorage.getItem(cacheKey(selected));
      if (!raw) return;
      const cached = JSON.parse(raw) as CachedDebrief;
      const cachedQa = Array.isArray(cached.qa)
        ? cached.qa.filter(
            (item): item is QA =>
              !!item && typeof item.q === "string" && typeof item.a === "string",
          )
        : [];
      setDebrief(cached.debrief ?? null);
      setQa(cachedQa);
      setSavedLocally(!!cached.debrief);

      if (cached.debrief && session && !session.localOnly && !cached.session) {
        localStorage.setItem(
          cacheKey(selected),
          JSON.stringify({
            ...cached,
            session: localSessionSnapshot(session, season, getActiveCareer()),
            savedAt: new Date().toISOString(),
          }),
        );
      }
    } catch (cacheLoadError) {
      console.error("Unable to restore the locally saved AI debrief.", cacheLoadError);
      setSaveError("The saved debrief on this device couldn't be read.");
    }
  }, [selected, session, season]);

  const save = (d: Debrief | null, q: QA[]) => {
    if (!selected) return;
    try {
      localStorage.setItem(
        cacheKey(selected),
        JSON.stringify({
          debrief: d,
          qa: q,
          session:
            session && !session.localOnly
              ? localSessionSnapshot(session, season, getActiveCareer())
              : undefined,
          savedAt: d ? new Date().toISOString() : undefined,
        } satisfies CachedDebrief),
      );
      setSavedLocally(!!d);
      setSaveError("");
    } catch (cacheSaveError) {
      console.error("Unable to save the AI debrief on this device.", cacheSaveError);
      setSavedLocally(false);
      setSaveError("This debrief couldn't be saved on this device.");
    }
  };

  async function generate() {
    if (!facts) return;
    setBusy(true);
    setError("");
    try {
      const r = await run({ data: { facts: facts as Record<string, unknown> } });
      if (!r.ok) setError(r.error);
      else if (r.debrief) {
        setDebrief(r.debrief);
        save(r.debrief, qa);
      }
    } catch {
      setError("The engineer couldn't be reached. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || !facts) return;
    setBusy(true);
    setError("");
    try {
      const r = await run({
        data: { facts: facts as Record<string, unknown>, question: q, history: qa.slice(-6) },
      });
      if (!r.ok) setError(r.error);
      else if (r.answer) {
        const next = [...qa, { q, a: r.answer }];
        setQa(next);
        setQuestion("");
        save(debrief, next);
      }
    } catch {
      setError("The engineer couldn't be reached. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  const c = facts?.consistency as { score?: number } | null | undefined;
  const race = facts?.race_comparison;

  return (
    <div className="space-y-4">
      {status && <p className="text-sm text-muted-foreground">{status}</p>}
      {loadFailed && (
        <Button variant="outline" onClick={() => setReload((value) => value + 1)}>
          Retry loading sessions
        </Button>
      )}
      {sessions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.session_type || s.category}
                {s.localOnly ? " · saved on device" : ""}
              </option>
            ))}
          </select>
          {typeof c?.score === "number" && (
            <span className="rounded-md bg-primary/15 px-3 py-2 text-sm font-semibold text-primary">
              Consistency {Math.round(c.score)}/100
            </span>
          )}
          {session?.localOnly ? (
            <span className="text-xs text-muted-foreground">
              Local copy · session data unavailable
            </span>
          ) : (
            <button
              onClick={generate}
              disabled={busy || !facts}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy && !debrief
                ? "Engineer is reviewing…"
                : debrief
                  ? "Regenerate debrief"
                  : "Get debrief"}
            </button>
          )}
        </div>
      )}
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {saveError && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {saveError}
        </p>
      )}

      {race && (
        <section
          className="space-y-3 rounded-lg border border-border bg-card p-4"
          aria-label="Race comparison"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wider">Race comparison</h3>
            <span className="text-xs text-muted-foreground">
              {race.field_size
                ? `${race.field_size} classified drivers`
                : "Classification unavailable"}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md bg-muted/40 p-3">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Result
              </div>
              <p className="mt-1 text-lg font-semibold">
                {race.position ? `P${race.position}` : "—"}
                {typeof race.position_gained === "number" && (
                  <span className="ml-2 text-sm text-muted-foreground">
                    {race.position_gained > 0
                      ? `+${race.position_gained} from grid`
                      : race.position_gained < 0
                        ? `${race.position_gained} from grid`
                        : "held grid position"}
                  </span>
                )}
              </p>
            </div>
            <div className="rounded-md bg-muted/40 p-3">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Official best lap
              </div>
              <p className="mt-1 text-lg font-semibold">{seconds(race.official_best_lap_s)}</p>
              <p className="text-xs text-muted-foreground">
                {race.official_best_lap_rank
                  ? `P${race.official_best_lap_rank} fastest · ${signedSeconds(race.gap_to_fastest_s)} to ${race.fastest_driver}`
                  : "No classified lap comparison"}
              </p>
            </div>
            <div className="rounded-md bg-muted/40 p-3">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Clean-lap field pace
              </div>
              <p className="mt-1 text-lg font-semibold">
                {race.clean_lap_field_pace
                  ? signedSeconds(race.clean_lap_field_pace.median_delta_ms / 1000)
                  : "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                {race.clean_lap_field_pace
                  ? `Median vs field across ${race.clean_lap_field_pace.laps_compared} clean laps`
                  : "No lap-by-lap field comparison"}
              </p>
            </div>
          </div>
          {race.position_history && (
            <p className="text-sm text-muted-foreground">
              Position trace: P{race.position_history.first.position} on lap{" "}
              {race.position_history.first.lap}
              {" → "}P{race.position_history.last.position} on lap {race.position_history.last.lap}
              {" · "}best P{race.position_history.best_position}
              {" · "}worst P{race.position_history.worst_position}
            </p>
          )}
          {race.nearby_drivers.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <caption className="mb-2 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Drivers immediately around you · positive lap delta means your best was slower
                </caption>
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="pb-2 pr-3 font-medium">Pos</th>
                    <th className="pb-2 pr-3 font-medium">Driver</th>
                    <th className="pb-2 pr-3 font-medium">Best lap</th>
                    <th className="pb-2 pr-3 font-medium">Lap delta</th>
                    <th className="pb-2 font-medium">Pit stops</th>
                  </tr>
                </thead>
                <tbody>
                  {race.nearby_drivers.map((rival) => (
                    <tr key={`${rival.pos}-${rival.name}`} className="border-t border-border/70">
                      <td className="py-2 pr-3">P{rival.pos}</td>
                      <td className="py-2 pr-3 font-medium">{rival.name}</td>
                      <td className="py-2 pr-3">{seconds(rival.best_lap_s)}</td>
                      <td className="py-2 pr-3">{signedSeconds(rival.gap_to_driver_best_s)}</td>
                      <td className="py-2">{rival.pits ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {facts && facts.stints.length > 0 && (
        <section
          className="space-y-3 rounded-lg border border-border bg-card p-4"
          aria-label="Stint analysis"
        >
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider">Stint analysis</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Pace uses clean laps only. Positive pace change means the later half was slower; it
              does not establish why.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[58rem] text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="pb-2 pr-3 font-medium">Stint</th>
                  <th className="pb-2 pr-3 font-medium">Clean laps</th>
                  <th className="pb-2 pr-3 font-medium">Median</th>
                  <th className="pb-2 pr-3 font-medium">Best</th>
                  <th className="pb-2 pr-3 font-medium">Early → late</th>
                  <th className="pb-2 pr-3 font-medium">Wear change</th>
                  <th className="pb-2 font-medium">Best sectors S1 / S2 / S3</th>
                </tr>
              </thead>
              <tbody>
                {facts.stints.map((stint) => (
                  <tr key={stint.stint} className="border-t border-border/70 align-top">
                    <td className="py-2 pr-3">
                      <span className="font-semibold">Stint {stint.stint}</span>
                      <span className="block text-xs text-muted-foreground">
                        L{stint.laps} · {stint.compound || "Unknown"} · {stint.length} laps
                      </span>
                    </td>
                    <td className="py-2 pr-3">{stint.clean_laps}</td>
                    <td className="py-2 pr-3">{seconds(stint.clean_median_lap_s)}</td>
                    <td className="py-2 pr-3">
                      {stint.best_clean_lap
                        ? `${seconds(stint.best_clean_lap.time_s)} (L${stint.best_clean_lap.lap})`
                        : "—"}
                    </td>
                    <td className="py-2 pr-3">{signedSeconds(stint.clean_pace_change_s)}</td>
                    <td className="py-2 pr-3">
                      {stint.wear_change_pct === null
                        ? "—"
                        : `${stint.wear_change_pct.toFixed(1)}% · ${stint.end_wear_pct?.toFixed(1) ?? "—"}% end`}
                    </td>
                    <td className="py-2">
                      {(["s1", "s2", "s3"] as const)
                        .map((sector) =>
                          stint.best_sectors[sector]
                            ? `${seconds(stint.best_sectors[sector].time_s)} (L${stint.best_sectors[sector].lap})`
                            : "—",
                        )
                        .join(" / ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {debrief && (
        <div className="space-y-4 rounded-lg border border-border bg-card p-4">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-primary text-3xl font-black italic text-primary-foreground">
              {debrief.grade}
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-bold">{debrief.headline}</h3>
              <p className="mt-1 border-l-2 border-primary pl-3 text-sm italic text-muted-foreground">
                📻 “{debrief.radio}”
              </p>
              {savedLocally && (
                <p className="mt-2 text-xs font-medium text-muted-foreground">
                  Saved on this device
                </p>
              )}
            </div>
          </div>
          <p className="text-sm">{debrief.summary}</p>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ["Consistency", debrief.consistency],
              ["Tyres", debrief.tyres],
              ["Pace", debrief.pace],
            ].map(([t, v]) => (
              <div key={t} className="rounded-md bg-muted/40 p-3">
                <div className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {t}
                </div>
                <p className="text-sm">{v}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Strengths
              </div>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {debrief.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Coaching notes
              </div>
              <ul className="space-y-1 text-sm">
                {debrief.improvements.map((s, i) => (
                  <li key={i}>
                    <b>{s.area}:</b> {s.detail}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {facts && (
        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Ask your engineer
          </div>
          {qa.map((m, i) => (
            <div key={i} className="space-y-1 text-sm">
              <p className="font-semibold">You: {m.q}</p>
              <p className="text-muted-foreground">{m.a}</p>
            </div>
          ))}
          <form onSubmit={ask} className="flex gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={500}
              placeholder="e.g. Where did I lose time in stint 2?"
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <button
              disabled={busy || !question.trim()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              Ask
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
