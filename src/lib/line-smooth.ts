import type { Point } from "@/lib/quali-simulation";

/** Smooths a closed racing line with a few Gaussian passes; keeps point count and start/finish point. */
export function smoothRacingLine(points: Point[], passes = 3): Point[] {
  const n = points.length;
  if (n < 5) return points.map((p) => ({ ...p }));
  const w = [1, 4, 6, 4, 1];
  let cur = points.map((p) => ({ ...p }));
  for (let k = 0; k < passes; k++) {
    cur = cur.map((_, i) => {
      let x = 0, y = 0;
      for (let j = -2; j <= 2; j++) {
        const p = cur[(i + j + n) % n];
        x += p.x * w[j + 2]; y += p.y * w[j + 2];
      }
      return { ...cur[i], x: x / 16, y: y / 16 };
    });
  }
  cur[0] = { ...points[0] };
  return cur;
}

export type TrackMask = { width: number; height: number; white: Uint8Array };

/** Builds a mask of the bright (white track) pixels in the map image. */
export function maskFromPixels(data: Uint8ClampedArray, width: number, height: number, threshold = 190): TrackMask {
  const white = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3];
    if (a > 100 && Math.min(r, g, b) >= threshold) white[i] = 1;
  }
  return { width, height, white };
}

/** Moves a normalized point onto the nearest white pixel within `radius` pixels (unchanged if none). */
export function snapToTrack(p: Point, mask: TrackMask, radius = 14): Point {
  const cx = Math.round(p.x * (mask.width - 1));
  const cy = Math.round(p.y * (mask.height - 1));
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < mask.width && y < mask.height && mask.white[y * mask.width + x] === 1;
  if (at(cx, cy)) return p;
  let best: [number, number] | null = null;
  let bestD = Infinity;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const d = dx * dx + dy * dy;
      if (d < bestD && d <= radius * radius && at(cx + dx, cy + dy)) { bestD = d; best = [cx + dx, cy + dy]; }
    }
  }
  if (!best) return p;
  return { ...p, x: best[0] / (mask.width - 1), y: best[1] / (mask.height - 1) };
}

/** Smooths the line while keeping every point on the white track of the map. */
export function smoothOnTrack(points: Point[], mask: TrackMask, rounds = 4): Point[] {
  let cur = points.map((p) => snapToTrack(p, mask));
  for (let r = 0; r < rounds; r++) {
    cur = smoothRacingLine(cur, 1).map((p) => snapToTrack(p, mask));
  }
  cur[0] = { ...points[0] };
  return cur;
}
