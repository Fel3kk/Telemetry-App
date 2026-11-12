import { describe, expect, it } from "vitest";
import { simulationFingerprint, solveSpeedProfile, telemetryAt, timeAtProgress } from "./quali-physics";

const line = Array.from({ length: 120 }, (_, i) => ({ x: 0.5 + 0.4 * Math.cos(i * Math.PI / 60), y: 0.5 + 0.35 * Math.sin(i * Math.PI / 60) }));
const driver = { name: "Piotr", position: 2, lap: 90, sectors: [25, 30, 35] as [number, number, number] };
describe("qualifying physics", () => {
  it("resamples to 120 points and caps curved apexes between 65 and 290 km/h", () => {
    const profile = solveSpeedProfile(line, driver, "zandvoort");
    expect(profile.points).toHaveLength(120);
    expect(Math.min(...profile.caps)).toBeGreaterThanOrEqual(65);
    const apexCaps = profile.caps.filter((_, i) => profile.radii[i] <= 1200);
    expect(apexCaps.length).toBeGreaterThan(0);
    expect(Math.max(...apexCaps)).toBeLessThanOrEqual(290);
    expect(Math.max(...profile.caps)).toBeLessThanOrEqual(350);
  });
  it("integrates exactly to official S1, S2, S3 and the lap", () => {
    const p = solveSpeedProfile(line, driver, "zandvoort");
    expect(timeAtProgress(p, 1 / 3)).toBeCloseTo(25, 9);
    expect(timeAtProgress(p, 2 / 3)).toBeCloseTo(55, 9);
    expect(timeAtProgress(p, 1)).toBe(90);
    expect(p.times[120] - p.times[80]).toBeCloseTo(35, 9);
  });
  it("provides finite speed, gears 1–8 and bounded pedal percentages at any time", () => {
    const p = solveSpeedProfile(line, driver, "zandvoort");
    for (const t of [-1, 0, 24.999, 25, 55, 89.999, 100]) {
      const hud = telemetryAt(p, t);
      expect(Number.isFinite(hud.speed)).toBe(true);
      expect(hud.gear).toBeGreaterThanOrEqual(1); expect(hud.gear).toBeLessThanOrEqual(8);
      expect(hud.throttle).toBeGreaterThanOrEqual(0); expect(hud.throttle).toBeLessThanOrEqual(100);
      expect(hud.brake).toBeGreaterThanOrEqual(0); expect(hud.brake).toBeLessThanOrEqual(100);
    }
    expect(telemetryAt(p, 100).progress).toBe(1);
  });
  it("invalidates only for a different session, line or official timing", () => {
    const key = simulationFingerprint("zandvoort", "q3", line, [driver]);
    expect(simulationFingerprint("zandvoort", "q3", [...line], [driver])).toBe(key);
    expect(simulationFingerprint("zandvoort", "q2", line, [driver])).not.toBe(key);
    expect(simulationFingerprint("zandvoort", "q3", line.slice(1), [driver])).not.toBe(key);
    expect(simulationFingerprint("zandvoort", "q3", line, [{ ...driver, lap: 91 }])).not.toBe(key);
    expect(simulationFingerprint("zandvoort", "q3", line, [{ ...driver, sectors: [26, 29, 35] }])).not.toBe(key);
  });
  it("rejects collapsed geometry", () => {
    expect(() => solveSpeedProfile([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }], driver, "zandvoort")).toThrow("usable length");
  });
});