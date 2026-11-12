import { driverMatches } from "./driver-identity";

type PreviewSession = {
  driver_name?: string;
  starting_position?: number | null;
  finishing_position?: number | null;
  stints?: unknown[];
  race_story?: unknown;
};

type DataObject = Record<string, unknown>;

export type TrackCardPreview = {
  positions: { start: number; finish: number } | null;
  stints: { compound: string; laps: number; startLap: number; endLap: number }[];
  laps: { lap: number; ms: number }[];
  fastestRival: { name: string; ms: number } | null;
  medianPaceDeltaMs: number | null;
  bestLapMs: number | null;
  averageLapMs: number | null;
};

const positiveNumber = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

const asObject = (value: unknown): DataObject | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as DataObject)
    : null;

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function buildTrackCardPreview(session?: PreviewSession | null): TrackCardPreview {
  const story = asObject(session?.race_story) ?? {};
  const driverTimes = Array.isArray(story.driver_lap_times) ? story.driver_lap_times : [];
  const playerName = String(story.player_name ?? session?.driver_name ?? "");
  const player = driverTimes
    .map(asObject)
    .find((entry) => entry && driverMatches(entry.name, playerName));
  const laps: { lap: number; ms: number }[] = [];
  const playerLaps = Array.isArray(player?.laps) ? player.laps : [];
  playerLaps.forEach((value, index) => {
    const entry = asObject(value);
    if (!entry || entry.valid === false) return;
    const ms = positiveNumber(entry.ms);
    if (ms !== null) {
      laps.push({ lap: positiveNumber(entry.lap) ?? index + 1, ms });
    }
  });

  const bestLapMs = laps.length ? Math.min(...laps.map((lap) => lap.ms)) : null;
  const averageLapMs = laps.length
    ? laps.reduce((sum, lap) => sum + lap.ms, 0) / laps.length
    : null;
  const rivalBest =
    driverTimes
      .map(asObject)
      .filter((entry): entry is DataObject => !!entry && !driverMatches(entry.name, playerName))
      .map((entry) => {
        const rivalLaps = Array.isArray(entry.laps) ? entry.laps : [];
        const rivalTimes = rivalLaps.flatMap((value) => {
          const lap = asObject(value);
          const ms = lap && lap.valid !== false ? positiveNumber(lap.ms) : null;
          return ms === null ? [] : [ms];
        });
        return rivalTimes.length
          ? { name: String(entry.name ?? ""), ms: Math.min(...rivalTimes) }
          : null;
      })
      .filter((entry): entry is { name: string; ms: number } => !!entry && !!entry.name)
      .sort((a, b) => a.ms - b.ms)[0] ?? null;

  const history = Array.isArray(story.position_history)
    ? story.position_history
        .map((value) => {
          const entry = asObject(value);
          return {
            lap: Number(entry?.lap),
            position: positiveNumber(entry?.position),
          };
        })
        .filter((entry) => entry.position !== null)
    : [];
  const start =
    history.find((entry) => entry.lap === 0)?.position ??
    history[0]?.position ??
    positiveNumber(session?.starting_position);
  const finish = history.at(-1)?.position ?? positiveNumber(session?.finishing_position);

  const stints = (Array.isArray(session?.stints) ? session.stints : [])
    .map((value) => {
      const stint = asObject(value);
      const tyreSet = asObject(stint?.["tyre-set-data"]);
      const startLap = positiveNumber(stint?.["start-lap"] ?? stint?.start_lap);
      const endLap = positiveNumber(stint?.["end-lap"] ?? stint?.end_lap);
      return {
        compound: String(tyreSet?.["visual-tyre-compound"] ?? stint?.compound ?? "").trim(),
        startLap: startLap ?? 0,
        endLap: endLap ?? 0,
        laps: startLap && endLap && endLap >= startLap ? endLap - startLap + 1 : 0,
      };
    })
    .filter((stint) => stint.compound || stint.laps > 0);

  const paceDeltas = (Array.isArray(story.pace_delta) ? story.pace_delta : [])
    .map((value) => {
      const entry = asObject(value);
      return entry?.delta_ms == null ? null : Number(entry.delta_ms);
    })
    .filter((value): value is number => value !== null && Number.isFinite(value));

  return {
    positions: start && finish ? { start, finish } : null,
    stints,
    laps,
    fastestRival: rivalBest,
    medianPaceDeltaMs: paceDeltas.length ? median(paceDeltas) : null,
    bestLapMs,
    averageLapMs,
  };
}

export function formatPreviewLapTime(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms <= 0) return "—";
  const minutes = Math.floor(ms / 60_000);
  const seconds = ((ms % 60_000) / 1000).toFixed(3).padStart(6, "0");
  return `${minutes}:${seconds}`;
}
