import { pointOnLine, type Point, type ReplayDriver } from "./quali-simulation";

export const PROFILE_VERSION = 2;
const G = 9.80665;
const COUNT = 120;
const MAX_CORNER_SPEED = 290 / 3.6;
const MIN_CORNER_SPEED = 65 / 3.6;
const SPEED_MAP_STOPS = [
  { at: 0, lightness: 0.64, chroma: 0.24, hue: 27 },
  { at: 0.2, lightness: 0.84, chroma: 0.2, hue: 95 },
  { at: 0.42, lightness: 0.72, chroma: 0.23, hue: 145 },
  { at: 1, lightness: 0.72, chroma: 0.23, hue: 145 },
];
export type SpeedProfile = {
  version: number;
  lap: number;
  times: number[];
  speeds: number[];
  points: Point[];
  radii: number[];
  caps: number[];
  corners: number[];
  distance: number;
};

// Physical circuit lengths; unlisted/modded layouts use an explicitly estimated scale.
const LENGTHS: Record<string, number> = {
  abu_dhabi: 5281,
  austria: 4318,
  baku: 6003,
  brazil: 4309,
  catalunya: 4657,
  hungaroring: 4381,
  jeddah: 6174,
  losail: 5419,
  madrid: 5474,
  melbourne: 5278,
  mexico: 4304,
  miami: 5412,
  monaco: 3337,
  monza: 5793,
  montreal: 4361,
  sakhir: 5412,
  shanghai: 5451,
  singapore: 4940,
  silverstone: 5891,
  spa: 7004,
  suzuka: 5807,
  texas: 5513,
  vegas: 6201,
  zandvoort: 4259,
};
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

/** Geometry and dynamics are estimates, not movement telemetry measured by the upload. */
export function solveSpeedProfile(
  line: Point[],
  driver: ReplayDriver,
  track: string,
): SpeedProfile {
  if (
    line.length < 3 ||
    !line.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)) ||
    !(driver.lap > 0)
  )
    throw new Error("A valid line and lap time are required.");
  const points = Array.from({ length: COUNT }, (_, i) => pointOnLine(line, i / COUNT));
  const metric = points.map((p) => ({ x: p.x, y: (p.y * 608) / 1080 }));
  const rawLengths = metric.map((p, i) =>
    Math.hypot(p.x - metric[(i + 1) % COUNT].x, p.y - metric[(i + 1) % COUNT].y),
  );
  const perimeter = rawLengths.reduce((a, b) => a + b, 0);
  if (perimeter < 1e-6) throw new Error("The racing line has no usable length.");
  const distance = LENGTHS[track.replace(/_reverse$/, "")] ?? (driver.lap * 210) / 3.6;
  const scale = distance / perimeter;
  const lengths = rawLengths.map((n) => n * scale);
  const radii = metric.map((b, i) => {
    const a = metric[(i + COUNT - 5) % COUNT],
      c = metric[(i + 5) % COUNT];
    const ab = Math.hypot(b.x - a.x, b.y - a.y),
      bc = Math.hypot(c.x - b.x, c.y - b.y),
      ac = Math.hypot(c.x - a.x, c.y - a.y);
    const cross = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
    return cross > 1e-10 ? ((ab * bc * ac) / (2 * cross)) * scale : 1e6;
  });
  let longestStraight = 0;
  let straightRun = 0;
  for (let i = 0; i < COUNT * 2; i++) {
    if (radii[i % COUNT] > 1200 && straightRun < distance) {
      straightRun += lengths[i % COUNT];
      longestStraight = Math.max(longestStraight, straightRun);
    } else {
      straightRun = 0;
    }
  }
  const topSpeed = (315 + 30 * clamp(longestStraight / 1000, 0, 1)) / 3.6;
  const caps = radii.map((radius) =>
    radius > 1200
      ? topSpeed
      : Math.min(topSpeed, clamp(Math.sqrt(2.8 * G * radius), MIN_CORNER_SPEED, MAX_CORNER_SPEED)),
  );
  const buildSpeeds = (cornerFactor: number) => {
    const velocity = caps.map((cap, i) =>
      radii[i] > 1200 ? topSpeed : clamp(cap * cornerFactor, MIN_CORNER_SPEED, topSpeed),
    );
    // The closed-loop envelope carries braking and acceleration smoothly over the start/finish.
    for (let pass = 0; pass < 6; pass++) {
      for (let i = COUNT - 1; i >= 0; i--) {
        const next = (i + 1) % COUNT;
        const braking = G * (2 + 2.5 * clamp(velocity[next] / (345 / 3.6), 0, 1));
        velocity[i] = Math.min(
          velocity[i],
          Math.sqrt(velocity[next] ** 2 + 2 * braking * lengths[i]),
        );
      }
      for (let i = 0; i < COUNT; i++) {
        const next = (i + 1) % COUNT;
        const acceleration = G * Math.max(0.45, 1.35 * (1 - velocity[i] / (345 / 3.6)));
        velocity[next] = Math.min(
          velocity[next],
          Math.sqrt(velocity[i] ** 2 + 2 * acceleration * lengths[i]),
        );
      }
    }
    return velocity;
  };
  const lapSeconds = (velocity: number[]) =>
    lengths.reduce(
      (sum, length, i) => sum + (2 * length) / (velocity[i] + velocity[(i + 1) % COUNT]),
      0,
    );
  let low = 0.02;
  let high = 8;
  let velocity = buildSpeeds(1);
  for (let iteration = 0; iteration < 48; iteration++) {
    const factor = (low + high) / 2;
    const candidate = buildSpeeds(factor);
    if (lapSeconds(candidate) > driver.lap) low = factor;
    else high = factor;
    velocity = candidate;
  }
  const segmentTimes = lengths.map(
    (length, i) => (2 * length) / (velocity[i] + velocity[(i + 1) % COUNT]),
  );
  const times = [0];
  for (const segmentTime of segmentTimes) times.push(times[times.length - 1] + segmentTime);
  const estimate = times[COUNT];
  if (Math.abs(estimate - driver.lap) > 0.05) {
    throw new Error(
      `The lap time cannot be matched without changing straight-line speed (physics estimate ${estimate.toFixed(2)}s, uploaded ${driver.lap.toFixed(2)}s). Check the racing line and lap time.`,
    );
  }
  times[COUNT] = driver.lap;
  const lap = driver.lap;
  const speeds = velocity.map((value) => value * 3.6);
  const candidates = caps
    .map((cap, i) => ({ cap, i }))
    .filter(
      ({ cap, i }) =>
        cap <= caps[(i + COUNT - 1) % COUNT] && cap < caps[(i + 1) % COUNT] && cap < 285 / 3.6,
    )
    .sort((a, b) => a.cap - b.cap);
  const corners: number[] = [];
  for (const { i } of candidates) {
    if (corners.every((j) => Math.min(Math.abs(i - j), COUNT - Math.abs(i - j)) >= 5))
      corners.push(i);
  }
  return {
    version: PROFILE_VERSION,
    lap,
    times,
    speeds,
    points,
    radii,
    caps: caps.map((n) => n * 3.6),
    corners: corners.sort((a, b) => a - b),
    distance,
  };
}

export function progressAtTime(profile: SpeedProfile, elapsed: number): number {
  const t = clamp(elapsed, 0, profile.lap);
  let i = 0;
  while (i < COUNT - 1 && profile.times[i + 1] <= t) i++;
  const dt = profile.times[i + 1] - profile.times[i];
  const timeFraction = clamp((t - profile.times[i]) / dt, 0, 1);
  const startSpeed = profile.speeds[i];
  const endSpeed = profile.speeds[(i + 1) % COUNT];
  const meanSpeed = (startSpeed + endSpeed) / 2;
  const distanceFraction =
    (startSpeed * timeFraction +
      0.5 * (endSpeed - startSpeed) * timeFraction ** 2) /
    meanSpeed;
  return t >= profile.lap ? 1 : (i + clamp(distanceFraction, 0, 1)) / COUNT;
}

export function timeAtProgress(profile: SpeedProfile, progress: number): number {
  const p = clamp(progress, 0, 1) * COUNT;
  const i = Math.min(COUNT - 1, Math.floor(p));
  const distanceFraction = p - i;
  const startSpeed = profile.speeds[i];
  const endSpeed = profile.speeds[(i + 1) % COUNT];
  const meanSpeed = (startSpeed + endSpeed) / 2;
  const delta = endSpeed - startSpeed;
  const timeFraction =
    Math.abs(delta) < 1e-9
      ? distanceFraction
      : (2 * distanceFraction * meanSpeed) /
        (startSpeed +
          Math.sqrt(
            Math.max(
              0,
              startSpeed ** 2 + 2 * delta * distanceFraction * meanSpeed,
            ),
          ));
  return (
    profile.times[i] +
    (profile.times[i + 1] - profile.times[i]) * clamp(timeFraction, 0, 1)
  );
}

export function relativeSpeedMapColor(speed: number, min: number, max: number): string {
  const range = max - min;
  const relativeSpeed = range > 0 ? clamp((speed - min) / range, 0, 1) : 0.25;
  const upperIndex = SPEED_MAP_STOPS.findIndex(
    (stop) => stop.at >= relativeSpeed,
  );
  const upper =
    SPEED_MAP_STOPS[
      upperIndex < 0 ? SPEED_MAP_STOPS.length - 1 : upperIndex
    ];
  const lower = SPEED_MAP_STOPS[Math.max(0, upperIndex - 1)];
  const progress =
    upper.at === lower.at ? 1 : (relativeSpeed - lower.at) / (upper.at - lower.at);
  const lightness = lower.lightness + (upper.lightness - lower.lightness) * progress;
  const chroma = lower.chroma + (upper.chroma - lower.chroma) * progress;
  const hue = lower.hue + (upper.hue - lower.hue) * progress;
  return `oklch(${lightness.toFixed(3)} ${chroma.toFixed(3)} ${hue.toFixed(1)})`;
}

export function simulationFingerprint(
  track: string,
  session: string,
  line: Point[],
  drivers: ReplayDriver[],
): string {
  const text = JSON.stringify([
    PROFILE_VERSION,
    line,
    drivers.map((d) => [d.name, d.lap, d.sectors]),
  ]);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return `${track}:${session}:${(hash >>> 0).toString(16)}`;
}
