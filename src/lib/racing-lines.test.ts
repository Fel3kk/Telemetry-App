import { describe, expect, it } from "vitest";
import { resampleClosedLine, resolveRacingLine, exportDeviceRacingLines, racingLineCollectionWith, sharedRacingLine, validGeneratedRacingLine, validRacingLine } from "./racing-lines";

const points = [{ x: 0.1, y: 0.2 }, { x: 0.7, y: 0.3 }, { x: 0.4, y: 0.9 }];
describe("owner-published racing lines", () => {
  it("provides the same published coordinates to devices with no saved line", () => {
    const published = { version: 1, tracks: { abu_dhabi: points } };
    expect(sharedRacingLine("Yas Marina", published)).toEqual(points);
    expect(sharedRacingLine("Abu Dhabi", JSON.parse(JSON.stringify(published)))).toEqual(points);
  });
  it("does not create a line for an unpublished track", () => {
    expect(sharedRacingLine("Silverstone", { tracks: {} })).toEqual([]);
  });
  it("rejects points outside the normalized map", () => {
    expect(validRacingLine([...points, { x: 1.1, y: 0.5 }])).toBe(false);
    expect(validRacingLine(points.slice(0, 2))).toBe(false);
  });
  it("accepts only usable AI drafts within the normalized map", () => {
    const draft = Array.from({ length: 40 }, (_, i) => ({ x: i / 39, y: 0.5 }));
    expect(validGeneratedRacingLine(draft)).toBe(true);
    expect(validGeneratedRacingLine(draft.slice(0, 19))).toBe(false);
    expect(validGeneratedRacingLine([...draft, ...draft, ...draft, ...draft, ...draft])).toBe(false);
    expect(validGeneratedRacingLine(draft.map((point) => ({ ...point, x: 1.1 })))).toBe(false);
  });
  it("replaces one track in the published collection without dropping other tracks", () => {
    const updated = racingLineCollectionWith("Yas Marina", points, { version: 1, tracks: { silverstone: points } });
    expect(updated).toEqual({ version: 1, tracks: { silverstone: points, abu_dhabi: points } });
  });
  it("keeps the existing calibrated Zandvoort line in the shared collection", () => {
    expect(sharedRacingLine("Zandvoort").length).toBeGreaterThan(20);
  });
  it("exports all old track lines together without unrelated device data", () => {
    const entries = new Map([
      ["f1.quali.line.v1.spa", JSON.stringify(points)],
      ["f1.quali.line.v1.silverstone", JSON.stringify(points)],
      ["f1.quali.line.v1.bad", "invalid"],
      ["unrelated", "private-data"],
    ]);
    const result = exportDeviceRacingLines({ length: entries.size, key: (i) => [...entries.keys()][i] ?? null, getItem: (key) => entries.get(key) ?? null });
    expect(result).toEqual({ version: 1, tracks: { spa: points, silverstone: points } });
  });
});
describe("account racing lines", () => {
  const published = { version: 1, tracks: { spa: [{ x: 0.5, y: 0.5 }, { x: 0.6, y: 0.5 }, { x: 0.6, y: 0.6 }] } };
  it("uses the line saved to the account on every device", () => {
    expect(resolveRacingLine("Spa", points, published)).toEqual(points);
  });
  it("falls back to the published line when the account has none or it is broken", () => {
    expect(resolveRacingLine("Spa", null, published)).toEqual(published.tracks.spa);
    expect(resolveRacingLine("Spa", [{ x: 2, y: 0 }], published)).toEqual(published.tracks.spa);
  });
  it("resamples an AI trace into evenly spaced points without a repeated closing point", () => {
    const square = [{ x: 0.1, y: 0.1 }, { x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 }, { x: 0.9, y: 0.9 }, { x: 0.1, y: 0.9 }, { x: 0.1, y: 0.1 }];
    const out = resampleClosedLine(square, 80);
    expect(out).toHaveLength(80);
    const gaps = out.map((p, i) => Math.hypot(p.x - out[(i + 1) % 80].x, p.y - out[(i + 1) % 80].y));
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(0.001);
  });
});
