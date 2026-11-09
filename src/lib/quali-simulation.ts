export type QualiResult = { name: string; position: number | string; best_lap?: string; q1?: string; q2?: string; q3?: string; s1?: string; s2?: string; s3?: string };
export type ReplayDriver = { name: string; position: number; lap: number; sectors?: [number, number, number] };
export type Point = { x: number; y: number };

export function seconds(value: string | undefined): number | null {
  if (!value || !/^\d+(?::\d{1,2})?(?:\.\d+)?$/.test(value.trim())) return null;
  const parts = value.trim().split(":").map(Number);
  const n = parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0];
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Sectors are only trusted when they add up to the lap within 0.05s.
function sectorsFor(r: QualiResult, lap: number): [number, number, number] | undefined {
  const s = [r.s1, r.s2, r.s3].map(seconds);
  if (s.some((v) => v === null)) return undefined;
  const [a, b, c] = s as number[];
  return Math.abs(a + b + c - lap) <= 0.05 ? [a, b, c] : undefined;
}

export function replayPair(results: QualiResult[], playerName: string): { player: ReplayDriver; rival: ReplayDriver } | null {
  const rows: ReplayDriver[] = results.map((r): ReplayDriver => {
    const lap = seconds(r.best_lap || r.q3 || r.q2 || r.q1);
    return { name: r.name, position: Number(r.position), lap: lap ?? 0, sectors: lap ? sectorsFor(r, lap) : undefined };
  }).filter((r: ReplayDriver) => !!r.name && r.lap >= 30 && r.lap <= 200 && r.position > 0);
  const player = rows.find((r) => r.name.trim().toLowerCase() === playerName.trim().toLowerCase());
  if (!player) return null;
  const rival = rows.find((r) => r.position === (player.position === 1 ? 2 : 1));
  return rival && rival.name !== player.name ? { player, rival } : null;
}

/** Progress 0..1 along the lap; with sectors, each third of the line takes that sector's time. */
export function lapProgress(elapsed: number, lap: number, sectors?: [number, number, number]): number {
  if (!(lap > 0)) return 0;
  if (!sectors) return Math.max(0, Math.min(1, elapsed / lap));
  let t = Math.max(0, elapsed);
  for (let i = 0; i < 3; i++) {
    if (t < sectors[i]) return (i + t / sectors[i]) / 3;
    t -= sectors[i];
  }
  return 1;
}

/** Live time gap at the current moment: positive when the player is behind. */
export function liveGap(elapsed: number, player: ReplayDriver, rival: ReplayDriver): number {
  const p = lapProgress(elapsed, player.lap, player.sectors);
  const r = lapProgress(elapsed, rival.lap, rival.sectors);
  const timeAt = (d: ReplayDriver, prog: number) => {
    if (!d.sectors) return prog * d.lap;
    const i = Math.min(2, Math.floor(prog * 3));
    return d.sectors.slice(0, i).reduce((a, b) => a + b, 0) + (prog * 3 - i) * d.sectors[i];
  };
  // Compare how long each driver needed to reach the furthest point both have passed.
  const point = Math.min(p, r);
  return timeAt(player, point) - timeAt(rival, point);
}

// Arc-length interpolation avoids accelerating simply because points are unevenly spaced.
export function pointOnLine(points: Point[], progress: number): Point {
  if (points.length === 0) return { x: 0.5, y: 0.5 };
  if (points.length === 1) return points[0];
  const closed = [...points, points[0]];
  const lengths = closed.slice(1).map((p, i) => Math.hypot(p.x - closed[i].x, (p.y - closed[i].y) * 608 / 1080));
  let distance = lengths.reduce((a, b) => a + b, 0) * Math.max(0, Math.min(1, progress));
  for (let i = 0; i < lengths.length; i++) {
    if (distance <= lengths[i] || i === lengths.length - 1) {
      const f = lengths[i] > 0 ? distance / lengths[i] : 0;
      return { x: closed[i].x + (closed[i + 1].x - closed[i].x) * f, y: closed[i].y + (closed[i + 1].y - closed[i].y) * f };
    }
    distance -= lengths[i];
  }
  return points[0];
}
