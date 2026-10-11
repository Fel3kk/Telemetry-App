export type QualiResult = { name: string; position: number | string; best_lap?: string; q1?: string; q2?: string; q3?: string; s1?: string; s2?: string; s3?: string };
export type ReplayDriver = { name: string; position: number; lap: number };
export type Point = { x: number; y: number };

export function seconds(value: string | undefined): number | null {
  if (!value || !/^\d+(?::\d{1,2})?(?:\.\d+)?$/.test(value.trim())) return null;
  const parts = value.trim().split(":").map(Number);
  const n = parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0];
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function replayPair(results: QualiResult[], playerName: string): { player: ReplayDriver; rival: ReplayDriver } | null {
  const rows = results.map((r) => ({ name: r.name, position: Number(r.position), lap: seconds(r.best_lap || r.q3 || r.q2 || r.q1) }))
    .filter((r): r is ReplayDriver => !!r.name && r.lap !== null && r.lap >= 30 && r.lap <= 200 && r.position > 0);
  const player = rows.find((r) => r.name.trim().toLowerCase() === playerName.trim().toLowerCase());
  if (!player) return null;
  const rival = rows.find((r) => r.position === (player.position === 1 ? 2 : 1));
  return rival && rival.name !== player.name ? { player, rival } : null;
}

export function lapProgress(elapsed: number, lap: number): number {
  return lap > 0 ? Math.max(0, Math.min(1, elapsed / lap)) : 0;
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

// Traced against the current Zandvoort bitmap; a replacement map can be recalibrated in the replay.
export const ZANDVOORT_LINE: Point[] = [
  [0.714,0.646],[0.691,0.743],[0.661,0.866],[0.638,0.939],[0.614,0.952],[0.591,0.925],
  [0.586,0.892],[0.603,0.806],[0.624,0.705],[0.625,0.645],[0.638,0.61],[0.668,0.59],
  [0.692,0.567],[0.695,0.533],[0.685,0.509],[0.667,0.501],[0.622,0.529],[0.575,0.544],
  [0.534,0.537],[0.479,0.52],[0.441,0.521],[0.408,0.554],[0.365,0.601],[0.323,0.607],
  [0.263,0.603],[0.226,0.597],[0.205,0.575],[0.195,0.544],[0.197,0.504],[0.208,0.457],
  [0.23,0.401],[0.249,0.344],[0.267,0.271],[0.279,0.225],[0.302,0.214],[0.334,0.225],
  [0.366,0.252],[0.391,0.288],[0.401,0.313],[0.395,0.338],[0.374,0.356],[0.332,0.374],
  [0.298,0.391],[0.282,0.414],[0.278,0.449],[0.285,0.478],[0.311,0.493],[0.361,0.498],
  [0.43,0.486],[0.496,0.465],[0.548,0.433],[0.584,0.406],[0.608,0.377],[0.617,0.382],
  [0.628,0.411],[0.644,0.422],[0.658,0.41],[0.664,0.386],[0.66,0.338],[0.652,0.255],
  [0.643,0.164],[0.635,0.109],[0.646,0.065],[0.671,0.045],[0.709,0.045],[0.741,0.061],
  [0.769,0.098],[0.787,0.148],[0.797,0.202],[0.796,0.25],[0.782,0.326],[0.759,0.442],[0.735,0.555],
].map(([x,y]) => ({x,y}));