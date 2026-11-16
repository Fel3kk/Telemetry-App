import { describe, expect, it } from "vitest";
import { maskFromPixels, smoothOnTrack } from "./line-smooth";
import { smoothRacingLine } from "./line-smooth";

describe("smoothRacingLine", () => {
  it("keeps point count and start point", () => {
    const pts = Array.from({ length: 20 }, (_, i) => ({ x: i % 2 ? 0.6 : 0.4, y: i / 20 }));
    const out = smoothRacingLine(pts);
    expect(out).toHaveLength(20);
    expect(out[0]).toEqual(pts[0]);
    expect(Math.abs(out[5].x - 0.5)).toBeLessThan(0.1);
  });
});

describe("smoothOnTrack", () => {
  it("keeps points on the white track", () => {
    const w = 50, h = 50, data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; const on = x >= 20 && x <= 22;
      data[i] = data[i + 1] = data[i + 2] = on ? 255 : 0; data[i + 3] = 255;
    }
    const mask = maskFromPixels(data, w, h);
    const pts = Array.from({ length: 20 }, (_, i) => ({ x: i % 2 ? 0.3 : 0.6, y: i / 20 }));
    const out = smoothOnTrack(pts, mask);
    for (const p of out.slice(1)) expect(Math.round(p.x * 49)).toBeGreaterThanOrEqual(20);
    for (const p of out.slice(1)) expect(Math.round(p.x * 49)).toBeLessThanOrEqual(22);
  });
});
