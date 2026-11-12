import { describe, expect, it } from "vitest";
import { coverage, projectOnLine, segmentSpan, sliceLine, nudge, isMapTap } from "./ers-map";

// A square on a 1080x608 map scaled so every side has equal real length.
const h = 0.4;
const w = h * (608 / 1080);
const SQUARE = [
  { x: 0.3, y: 0.3 },
  { x: 0.3 + w, y: 0.3 },
  { x: 0.3 + w, y: 0.3 + h },
  { x: 0.3, y: 0.3 + h },
];

describe("ERS map geometry", () => {
  it("does not paint when a finger scrolls across the map", () => {
    expect(isMapTap({ x: 100, y: 100 }, { x: 104, y: 103 })).toBe(true);
    expect(isMapTap({ x: 100, y: 100 }, { x: 100, y: 140 })).toBe(false);
  });
  it("measures a segment that wraps past the finish line", () => {
    expect(segmentSpan(0.9, 0.1)).toBeCloseTo(0.2, 6);
    expect(segmentSpan(0.2, 0.5)).toBeCloseTo(0.3, 6);
  });

  it("snaps a tap onto the racing line and reports lap progress", () => {
    const corner = projectOnLine(SQUARE, { x: 0.3 + w, y: 0.3 });
    expect(corner.progress).toBeCloseTo(0.25, 3);
    const mid = projectOnLine(SQUARE, { x: 0.3 + w + 0.01, y: 0.3 + h / 2 });
    expect(mid.progress).toBeCloseTo(0.375, 3);
  });

  it("follows the line through corners and across S/F", () => {
    const path = sliceLine(SQUARE, 0.875, 0.125);
    expect(path[0].x).toBeCloseTo(0.3, 4);
    expect(path.some((p) => p.x === SQUARE[0].x && p.y === SQUARE[0].y)).toBe(true);
    expect(path.at(-1)?.x).toBeCloseTo(0.3 + w / 2, 4);
  });

  it("lets a later segment paint over an earlier one", () => {
    const c = coverage([
      { id: "a", colorId: "green", start: 0, end: 0.5 },
      { id: "b", colorId: "blue", start: 0.4, end: 0.6 },
    ]);
    expect(c.green).toBeCloseTo(0.4, 2);
    expect(c.blue).toBeCloseTo(0.2, 2);
    expect(c[""]).toBeCloseTo(0.4, 2);
  });

  it("wraps nudged pins around the lap", () => {
    expect(nudge(0.998, 0.005)).toBeCloseTo(0.003, 4);
    expect(nudge(0.001, -0.005)).toBeCloseTo(0.996, 4);
  });
});
