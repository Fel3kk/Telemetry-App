// Pure geometry + model helpers for the ERS Map editor.
// Positions along the lap are "progress" values in [0, 1) measured by
// arc length along the calibrated racing line, starting at the S/F point.
import type { Point } from "./quali-simulation";

export type ErsMode = "race" | "quali";
export type ErsColor = { id: string; name: string; color: string };
export type ErsSegment = { id: string; colorId: string; start: number; end: number };
export type ErsSlotMeta = { id: string; name: string };

const ASPECT = 608 / 1080;

/** A scroll gesture must never paint a new section. */
export function isMapTap(start: Point, end: Point): boolean {
  return Math.hypot(end.x - start.x, end.y - start.y) <= 10;
}

function lengths(points: Point[]): number[] {
  const closed = [...points, points[0]];
  return closed.slice(1).map((p, i) => Math.hypot(p.x - closed[i].x, (p.y - closed[i].y) * ASPECT));
}

export function wrap(value: number): number {
  const v = value % 1;
  return v < 0 ? v + 1 : v;
}

/** Fraction of the lap a segment covers, including wraparound past S/F. */
export function segmentSpan(start: number, end: number): number {
  const s = wrap(start);
  const e = wrap(end);
  return e >= s ? e - s : 1 - s + e;
}

/** Snap a tapped point onto the closed line; returns its lap progress and distance (map-width units). */
export function projectOnLine(points: Point[], p: Point): { progress: number; distance: number } {
  if (points.length < 2) return { progress: 0, distance: Infinity };
  const closed = [...points, points[0]];
  const segs = lengths(points);
  const total = segs.reduce((a, b) => a + b, 0) || 1;
  let best = { progress: 0, distance: Infinity };
  let run = 0;
  for (let i = 0; i < segs.length; i++) {
    const a = closed[i];
    const b = closed[i + 1];
    const dx = b.x - a.x;
    const dy = (b.y - a.y) * ASPECT;
    const px = p.x - a.x;
    const py = (p.y - a.y) * ASPECT;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, (px * dx + py * dy) / len2)) : 0;
    const d = Math.hypot(px - t * dx, py - t * dy);
    if (d < best.distance) best = { progress: wrap((run + t * segs[i]) / total), distance: d };
    run += segs[i];
  }
  return best;
}

function pointAt(points: Point[], segs: number[], total: number, progress: number): { point: Point; index: number } {
  const closed = [...points, points[0]];
  let distance = wrap(progress) * total;
  for (let i = 0; i < segs.length; i++) {
    if (distance <= segs[i] || i === segs.length - 1) {
      const f = segs[i] > 0 ? Math.min(1, distance / segs[i]) : 0;
      return { point: { x: closed[i].x + (closed[i + 1].x - closed[i].x) * f, y: closed[i].y + (closed[i + 1].y - closed[i].y) * f }, index: i };
    }
    distance -= segs[i];
  }
  return { point: points[0], index: 0 };
}

/** Polyline following the racing line from start to end (driving direction, wraps past S/F). */
export function sliceLine(points: Point[], start: number, end: number): Point[] {
  if (points.length < 2) return [];
  const segs = lengths(points);
  const total = segs.reduce((a, b) => a + b, 0) || 1;
  const span = segmentSpan(start, end);
  const a = pointAt(points, segs, total, start);
  const out: Point[] = [a.point];
  if (span <= 0) return out;
  let traveled = 0;
  let index = a.index;
  const startDist = wrap(start) * total;
  // distance from start position to the end of its own segment
  let cumulative = segs.slice(0, index + 1).reduce((x, y) => x + y, 0);
  let toVertex = cumulative - startDist;
  const goal = span * total;
  const n = points.length;
  let guard = 0;
  while (traveled + toVertex < goal && guard++ < n + 2) {
    traveled += toVertex;
    index = (index + 1) % n;
    out.push(points[index]);
    toVertex = segs[index];
  }
  out.push(pointAt(points, segs, total, wrap(start + span)).point);
  return out;
}

export function pointAtProgress(points: Point[], progress: number): Point {
  if (points.length < 2) return points[0] ?? { x: 0.5, y: 0.5 };
  const segs = lengths(points);
  const total = segs.reduce((a, b) => a + b, 0) || 1;
  return pointAt(points, segs, total, progress).point;
}

/**
 * Share of the lap painted per colour. Later segments paint over earlier ones,
 * matching how they are drawn. Unpainted share is returned under "".
 */
export function coverage(segments: ErsSegment[], bins = 1000): Record<string, number> {
  const owner: string[] = new Array(bins).fill("");
  for (const seg of segments) {
    const span = segmentSpan(seg.start, seg.end);
    const first = Math.round(wrap(seg.start) * bins);
    const count = Math.round(span * bins);
    for (let k = 0; k < count; k++) owner[(first + k) % bins] = seg.colorId;
  }
  const out: Record<string, number> = {};
  for (const id of owner) out[id] = (out[id] ?? 0) + 1 / bins;
  return out;
}

/** Segments ordered by where they start on the lap (from S/F). */
export function lapOrder(segments: ErsSegment[]): ErsSegment[] {
  return [...segments].sort((a, b) => wrap(a.start) - wrap(b.start));
}

export function nudge(value: number, delta: number): number {
  return Math.round(wrap(value + delta) * 10000) / 10000;
}

// ---- Storage keys (track-based, so maps carry across every season) ----
export const ersKeys = {
  palette: "f1.ers.palette.v1",
  slots: (slug: string, mode: ErsMode) => `f1.ers.slots.v1.${slug}.${mode}`,
  activeSlot: (slug: string, mode: ErsMode) => `f1.ers.active.v1.${slug}.${mode}`,
  map: (slug: string, mode: ErsMode, slotId: string) => `f1.ers.maps.v1.${slug}.${mode}.${slotId}`,
};

export function isValidSegment(s: unknown): s is ErsSegment {
  const v = s as ErsSegment;
  return !!v && typeof v.id === "string" && typeof v.colorId === "string" && Number.isFinite(v.start) && Number.isFinite(v.end) && v.start >= 0 && v.start <= 1 && v.end >= 0 && v.end <= 1;
}
