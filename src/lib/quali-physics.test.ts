import { describe, expect, it } from "vitest";
import {
  progressAtTime,
  relativeSpeedMapColor,
  simulationFingerprint,
  solveSpeedProfile,
  timeAtProgress,
} from "./quali-physics";
import { sharedRacingLine } from "./racing-lines";

const line = [
  { x: 0.1, y: 0.15 },
  { x: 0.9, y: 0.15 },
  { x: 0.9, y: 0.85 },
  { x: 0.1, y: 0.85 },
];
const driver = {
  name: "Piotr",
  position: 2,
  lap: 90,
  sectors: [25, 30, 35] as [number, number, number],
};
describe("qualifying physics", () => {
  it("preserves straight-line speed and caps corner speeds", () => {
    const profile = solveSpeedProfile(line, driver, "zandvoort");
    expect(profile.points).toHaveLength(120);
    expect(Math.min(...profile.caps)).toBeGreaterThanOrEqual(65);
    const apexCaps = profile.caps.filter((_, i) => profile.radii[i] <= 1200);
    expect(apexCaps.length).toBeGreaterThan(0);
    expect(Math.max(...apexCaps)).toBeLessThanOrEqual(290);
    expect(Math.max(...profile.speeds)).toBeGreaterThanOrEqual(315);
    expect(Math.max(...profile.speeds)).toBeLessThanOrEqual(345);
  });
  it("uses lower peak speeds on a circuit geometry without long straights", () => {
    const roundLine = Array.from({ length: 120 }, (_, i) => ({
      x: 0.5 + 0.2 * Math.cos((i * Math.PI) / 60),
      y: 0.5 + ((0.2 * 1080) / 608) * Math.sin((i * Math.PI) / 60),
    }));
    const straights = solveSpeedProfile(line, driver, "zandvoort");
    const round = solveSpeedProfile(roundLine, driver, "zandvoort");
    expect(Math.max(...straights.speeds)).toBeGreaterThanOrEqual(315);
    expect(Math.max(...round.speeds)).toBeLessThan(315);
  });
  it("solves a calibrated published racing line to the uploaded lap time", () => {
    const profile = solveSpeedProfile(
      sharedRacingLine("zandvoort"),
      { ...driver, lap: 75 },
      "zandvoort",
    );
    expect(profile.lap).toBeCloseTo(75, 2);
    expect(Math.max(...profile.speeds)).toBeGreaterThanOrEqual(315);
    expect(Math.max(...profile.speeds)).toBeLessThanOrEqual(345);
  });
  it("matches the official lap without sector-wide time dilation", () => {
    const p = solveSpeedProfile(line, driver, "zandvoort");
    expect(p.times).toHaveLength(121);
    expect(p.lap).toBeCloseTo(driver.lap, 2);
    expect(timeAtProgress(p, 1)).toBeCloseTo(driver.lap, 2);
    expect(p.times[40]).not.toBeCloseTo(driver.sectors[0], 1);
    expect(p.times[80] - p.times[40]).not.toBeCloseTo(driver.sectors[1], 1);
  });
  it("keeps the velocity curve continuous across sector boundaries", () => {
    const p = solveSpeedProfile(line, driver, "zandvoort");
    expect(Math.abs(p.speeds[40] - p.speeds[39])).toBeLessThan(8);
    expect(Math.abs(p.speeds[80] - p.speeds[79])).toBeLessThan(8);
    expect(Math.abs(p.speeds[0] - p.speeds[119])).toBeLessThan(8);
    expect(progressAtTime(p, -1)).toBe(0);
    expect(progressAtTime(p, 1)).toBeGreaterThan(progressAtTime(p, 0));
    expect(progressAtTime(p, 100)).toBe(1);
  });
  it("varies movement pace through acceleration and braking and inverts it consistently", () => {
    const p = solveSpeedProfile(line, driver, "zandvoort");
    const minSpeed = Math.min(...p.speeds);
    const maxSpeed = Math.max(...p.speeds);
    expect(maxSpeed / minSpeed).toBeGreaterThan(1.5);
    const acceleratingIndex = p.speeds.findIndex(
      (value, i) => p.speeds[(i + 1) % p.speeds.length] > value + 1,
    );
    expect(acceleratingIndex).toBeGreaterThanOrEqual(0);
    const time = (p.times[acceleratingIndex] + p.times[acceleratingIndex + 1]) / 2;
    expect(progressAtTime(p, time)).toBeLessThan(
      (acceleratingIndex + 0.5) / p.speeds.length,
    );
    expect(timeAtProgress(p, progressAtTime(p, time))).toBeCloseTo(time, 8);

    const segmentMeans = p.speeds.map(
      (value, i) => (value + p.speeds[(i + 1) % p.speeds.length]) / 2,
    );
    const fastIndex = segmentMeans.indexOf(Math.max(...segmentMeans));
    const slowIndex = segmentMeans.indexOf(Math.min(...segmentMeans));
    const distanceInTime = (index: number) => {
      const midpoint = (p.times[index] + p.times[index + 1]) / 2;
      return (
        progressAtTime(p, midpoint + 0.05) -
        progressAtTime(p, midpoint - 0.05)
      );
    };
    expect(distanceInTime(fastIndex)).toBeGreaterThan(
      distanceInTime(slowIndex) * 1.5,
    );
  });
  it("brings yellow in early and keeps slow/fast map colors distinct", () => {
    expect(relativeSpeedMapColor(0, 0, 1)).toBe("oklch(0.640 0.240 27.0)");
    expect(relativeSpeedMapColor(0.2, 0, 1)).toBe("oklch(0.840 0.200 95.0)");
    expect(relativeSpeedMapColor(0.42, 0, 1)).toBe("oklch(0.720 0.230 145.0)");
    expect(relativeSpeedMapColor(1, 0, 1)).toBe("oklch(0.720 0.230 145.0)");
  });
  it("invalidates only for a different session, line or official timing", () => {
    const key = simulationFingerprint("zandvoort", "q3", line, [driver]);
    expect(simulationFingerprint("zandvoort", "q3", [...line], [driver])).toBe(key);
    expect(simulationFingerprint("zandvoort", "q2", line, [driver])).not.toBe(key);
    expect(simulationFingerprint("zandvoort", "q3", line.slice(1), [driver])).not.toBe(key);
    expect(simulationFingerprint("zandvoort", "q3", line, [{ ...driver, lap: 91 }])).not.toBe(key);
    expect(
      simulationFingerprint("zandvoort", "q3", line, [{ ...driver, sectors: [26, 29, 35] }]),
    ).not.toBe(key);
  });
  it("rejects collapsed geometry", () => {
    expect(() =>
      solveSpeedProfile(
        [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 },
        ],
        driver,
        "zandvoort",
      ),
    ).toThrow("usable length");
  });
});
