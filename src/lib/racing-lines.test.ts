import { describe, expect, it } from "vitest";
import { exportDeviceRacingLines, sharedRacingLine, validRacingLine } from "./racing-lines";

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