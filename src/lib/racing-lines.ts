import collection from "@/data/racing-lines.json";
import { trackSlug } from "./f1-shell";
import type { Point } from "./quali-simulation";

export type RacingLineCollection = { version: 1; tracks: Record<string, Point[]> };

export function validRacingLine(value: unknown): value is Point[] {
  return Array.isArray(value) && value.length >= 3 && value.every((point) =>
    point && Number.isFinite(point.x) && Number.isFinite(point.y) &&
    point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1);
}

export function validGeneratedRacingLine(value: unknown): value is Point[] {
  return Array.isArray(value) && value.length >= 20 && value.length <= 160 && validRacingLine(value);
}

/** Published site data only: device-local lines can never override this collection. */
export function sharedRacingLine(track: string, source: unknown = collection): Point[] {
  if (!source || typeof source !== "object" || !("tracks" in source)) return [];
  const tracks = source.tracks;
  if (!tracks || typeof tracks !== "object") return [];
  const points = (tracks as Record<string, unknown>)[trackSlug(track)];
  return validRacingLine(points) ? points.map((point) => ({ ...point })) : [];
}

export function racingLineCollectionWith(track: string, points: Point[], source: unknown = collection): RacingLineCollection {
  if (!validRacingLine(points)) throw new Error("A racing line needs at least three normalized points.");
  const tracks: Record<string, Point[]> = {};
  if (source && typeof source === "object" && "tracks" in source) {
    const savedTracks = source.tracks;
    if (savedTracks && typeof savedTracks === "object") {
      for (const [slug, line] of Object.entries(savedTracks)) {
        if (!validRacingLine(line)) throw new Error(`The published racing line for ${slug} is invalid.`);
        tracks[slug] = line.map((point) => ({ ...point }));
      }
    }
  }
  tracks[trackSlug(track)] = points.map((point) => ({ ...point }));
  return { version: 1, tracks };
}

export function downloadRacingLineCollection(track: string, points: Point[]): void {
  if (!validRacingLine(points)) throw new Error("A racing line needs at least three normalized points.");
  if (typeof document === "undefined") throw new Error("The shared racing-line collection can only be downloaded in a browser.");
  const blob = new Blob([JSON.stringify(racingLineCollectionWith(track, points), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "racing-lines.json";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Read-only migration export. No upload or publication endpoint exists in the app. */
export function exportDeviceRacingLines(storage: Pick<Storage, "length" | "key" | "getItem">): RacingLineCollection {
  const tracks: Record<string, Point[]> = {};
  const prefix = "f1.quali.line.v1.";
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(prefix)) continue;
    try {
      const points: unknown = JSON.parse(storage.getItem(key) ?? "null");
      if (validRacingLine(points)) tracks[trackSlug(key.slice(prefix.length))] = points;
    } catch { /* Preserve other lines when one old entry is corrupt. */ }
  }
  return { version: 1, tracks };
}
/** A line the signed-in user saved to their account wins over the published collection. */
export function resolveRacingLine(track: string, accountLine: unknown, source: unknown = collection): Point[] {
  if (validRacingLine(accountLine)) return accountLine.map((point) => ({ x: point.x, y: point.y }));
  return sharedRacingLine(track, source);
}

/**
 * Clean an AI trace: drop near-duplicate and closing points, then resample to
 * evenly spaced points along the closed loop so playback and ERS painting are smooth.
 */
export function resampleClosedLine(points: Point[], count = 120): Point[] {
  const pts: Point[] = [];
  for (const p of points) {
    const last = pts[pts.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 0.002) pts.push({ x: p.x, y: p.y });
  }
  while (pts.length > 3 && Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 0.002) pts.pop();
  if (pts.length < 3) return pts;
  const loop = [...pts, pts[0]];
  const cum = [0];
  for (let i = 1; i < loop.length; i++) cum.push(cum[i - 1] + Math.hypot(loop[i].x - loop[i - 1].x, loop[i].y - loop[i - 1].y));
  const total = cum[cum.length - 1];
  const out: Point[] = [];
  let j = 1;
  for (let k = 0; k < count; k++) {
    const d = (k / count) * total;
    while (j < cum.length - 1 && cum[j] < d) j++;
    const span = cum[j] - cum[j - 1] || 1;
    const t = (d - cum[j - 1]) / span;
    const a = loop[j - 1], b = loop[j];
    out.push({ x: Math.min(1, Math.max(0, a.x + (b.x - a.x) * t)), y: Math.min(1, Math.max(0, a.y + (b.y - a.y) * t)) });
  }
  return out;
}
