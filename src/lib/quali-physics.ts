import { pointOnLine, type Point, type ReplayDriver } from "./quali-simulation";

export const PROFILE_VERSION = 1;
const G = 9.80665;
const COUNT = 120;
export type SpeedProfile = {
  version: number; lap: number; times: number[]; speeds: number[]; points: Point[];
  radii: number[]; caps: number[]; corners: number[]; distance: number;
};
export type LiveTelemetry = { progress: number; speed: number; gear: number; throttle: number; brake: number };

// Physical circuit lengths; unlisted/modded layouts use an explicitly estimated scale.
const LENGTHS: Record<string, number> = {
  melbourne: 5278, shanghai: 5451, suzuka: 5807, bahrain: 5412, jeddah: 6174,
  miami: 5412, imola: 4909, monaco: 3337, barcelona: 4657, montreal: 4361,
  austria: 4318, silverstone: 5891, spa: 7004, hungary: 4381, zandvoort: 4259,
  monza: 5793, baku: 6003, singapore: 4940, texas: 5513, mexico: 4304,
  brazil: 4309, vegas: 6201, losail: 5419, abu_dhabi: 5281,
};
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

/** Geometry and dynamics are estimates, not movement telemetry measured by the upload. */
export function solveSpeedProfile(line: Point[], driver: ReplayDriver, track: string): SpeedProfile {
  if (line.length < 3 || !line.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)) || !(driver.lap > 0)) throw new Error("A valid line and lap time are required.");
  const points = Array.from({ length: COUNT }, (_, i) => pointOnLine(line, i / COUNT));
  const metric = points.map(p => ({ x: p.x, y: p.y * 608 / 1080 }));
  const rawLengths = metric.map((p, i) => Math.hypot(p.x - metric[(i + 1) % COUNT].x, p.y - metric[(i + 1) % COUNT].y));
  const perimeter = rawLengths.reduce((a, b) => a + b, 0);
  if (perimeter < 1e-6) throw new Error("The racing line has no usable length.");
  const distance = LENGTHS[track.replace(/_reverse$/, "")] ?? driver.lap * 210 / 3.6;
  const scale = distance / perimeter;
  const lengths = rawLengths.map(n => n * scale);
  const radii = metric.map((b, i) => {
    const a = metric[(i + COUNT - 2) % COUNT], c = metric[(i + 2) % COUNT];
    const ab = Math.hypot(b.x - a.x, b.y - a.y), bc = Math.hypot(c.x - b.x, c.y - b.y), ac = Math.hypot(c.x - a.x, c.y - a.y);
    const cross = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
    return cross > 1e-10 ? ab * bc * ac / (2 * cross) * scale : 1e6;
  });
  const caps = radii.map(r => r > 1200 ? 350 / 3.6 : clamp(Math.sqrt(2.8 * G * r), 65 / 3.6, 290 / 3.6));
  const velocity = [...caps];
  // Iterate the closed loop so braking and acceleration also cross the finish line.
  for (let pass = 0; pass < 6; pass++) {
    for (let i = COUNT - 1; i >= 0; i--) {
      const next = (i + 1) % COUNT;
      const braking = G * (2 + 2.5 * clamp(velocity[next] / (350 / 3.6), 0, 1));
      velocity[i] = Math.min(velocity[i], Math.sqrt(velocity[next] ** 2 + 2 * braking * lengths[i]));
    }
    for (let i = 0; i < COUNT; i++) {
      const next = (i + 1) % COUNT;
      const acceleration = G * Math.max(0.18, 1.35 * (1 - velocity[i] / (350 / 3.6)));
      velocity[next] = Math.min(velocity[next], Math.sqrt(velocity[i] ** 2 + 2 * acceleration * lengths[i]));
    }
  }
  const rawTimes = lengths.map((d, i) => 2 * d / (velocity[i] + velocity[(i + 1) % COUNT]));
  const sectors = driver.sectors ?? [driver.lap / 3, driver.lap / 3, driver.lap / 3];
  const times = [0], speeds: number[] = [];
  for (let sector = 0; sector < 3; sector++) {
    const start = sector * 40;
    const total = rawTimes.slice(start, start + 40).reduce((a, b) => a + b, 0);
    const factor = sectors[sector] / total;
    for (let i = start; i < start + 40; i++) {
      const dt = rawTimes[i] * factor;
      times.push(times[times.length - 1] + dt);
      speeds.push(lengths[i] / dt * 3.6);
    }
  }
  times[COUNT] = driver.lap;
  const candidates = caps.map((cap, i) => ({ cap, i })).filter(({ cap, i }) =>
    cap <= caps[(i + COUNT - 1) % COUNT] && cap < caps[(i + 1) % COUNT] && cap < 285 / 3.6).sort((a, b) => a.cap - b.cap);
  const corners: number[] = [];
  for (const { i } of candidates) {
    if (corners.every(j => Math.min(Math.abs(i - j), COUNT - Math.abs(i - j)) >= 5)) corners.push(i);
  }
  return { version: PROFILE_VERSION, lap: driver.lap, times, speeds, points, radii, caps: caps.map(n => n * 3.6), corners: corners.sort((a, b) => a - b), distance };
}

export function telemetryAt(profile: SpeedProfile, elapsed: number): LiveTelemetry {
  const t = clamp(elapsed, 0, profile.lap);
  let i = 0;
  while (i < COUNT - 1 && profile.times[i + 1] <= t) i++;
  const dt = profile.times[i + 1] - profile.times[i];
  const f = clamp((t - profile.times[i]) / dt, 0, 1);
  const next = (i + 1) % COUNT;
  const speed = profile.speeds[i] + (profile.speeds[next] - profile.speeds[i]) * f;
  const acceleration = (profile.speeds[next] - profile.speeds[i]) / 3.6 / dt;
  const brake = clamp(-acceleration / (4.5 * G), 0, 1) * 100;
  const throttle = brake > 2 ? 0 : clamp(0.25 + acceleration / (1.35 * G), 0, 1) * 100;
  return { progress: t >= profile.lap ? 1 : (i + f) / COUNT, speed, gear: clamp(Math.ceil(speed / 45), 1, 8), throttle, brake };
}

export function timeAtProgress(profile: SpeedProfile, progress: number): number {
  const p = clamp(progress, 0, 1) * COUNT;
  const i = Math.min(COUNT - 1, Math.floor(p));
  return profile.times[i] + (profile.times[i + 1] - profile.times[i]) * (p - i);
}

export function simulationFingerprint(track: string, session: string, line: Point[], drivers: ReplayDriver[]): string {
  const text = JSON.stringify([PROFILE_VERSION, line, drivers.map(d => [d.name, d.lap, d.sectors])]);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return `${track}:${session}:${(hash >>> 0).toString(16)}`;
}