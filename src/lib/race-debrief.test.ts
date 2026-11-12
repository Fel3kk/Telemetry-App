import { describe, expect, it } from "vitest";
import { raceConsistency, scoreFromSpread, buildDebriefFacts, splitStints, verifiedPitLaps, classifyQualifyingLaps, type DebriefLap } from "./race-debrief";

const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(3).padStart(6, "0")}`;
function laps(times: number[], extra: (i: number) => Partial<DebriefLap> = () => ({})): DebriefLap[] {
  return times.map((t, i) => ({ lap: i + 1, lap_time: fmt(t), current_tyre_compound: "Medium", pit_status: 0, sc_status: 0, ...extra(i + 1) }));
}

describe("race consistency", () => {
  it("scores the published reference points", () => {
    expect(scoreFromSpread(0.2)).toBeCloseTo(91.8, 0);
    expect(scoreFromSpread(0.5)).toBeCloseTo(73.9, 0);
    expect(scoreFromSpread(1)).toBe(50);
    expect(scoreFromSpread(2)).toBeCloseTo(26.1, 0);
  });

  it("does not punish steady fuel burn: laps 0.08 s quicker every lap score ~100", () => {
    const c = raceConsistency(laps(Array.from({ length: 20 }, (_, i) => 95 - i * 0.08)));
    expect(c.score).toBeGreaterThan(99);
  });

  it("does not penalize accelerating tyre degradation on a long stint", () => {
    const degradingPace = Array.from({ length: 18 }, (_, i) => 95 - i * 0.08 + i * i * 0.018);
    const c = raceConsistency(laps(degradingPace));
    expect(c.score).toBeGreaterThan(99);
    expect(c.stints[0].trend).toBeGreaterThan(0);
  });

  it("a tidy race with normal traffic laps no longer lands around 50", () => {
    const noise = [0.2, -0.3, 0.1, -0.1, 0.3, -0.2, 0.0, 0.2, -0.3, 0.1, -0.1, 0.25, -0.15, 0.05, -0.2, 0.1, 0.0, -0.1];
    const pace = noise.map((n, i) => 92 - i * 0.05 + n);
    pace[7] += 1.2; pace[13] += 1.3; // stuck behind a car twice
    const c = raceConsistency(laps(pace));
    expect(c.score).toBeGreaterThan(65);
  });

  it("an 8 s spread scores far below a 2 s spread", () => {
    const wobble = (amp: number) => Array.from({ length: 16 }, (_, i) => 90 + (i % 2 ? amp / 2 : -amp / 2));
    const tight = raceConsistency(laps(wobble(2))).score!;
    const loose = raceConsistency(laps(wobble(8))).score!;
    expect(loose).toBeLessThan(tight);
  });

  it("excludes lap 1, pit, out, safety-car and restart laps", () => {
    const base = Array.from({ length: 12 }, () => 90);
    base[0] = 110; base[4] = 115; base[5] = 100; base[8] = 140; base[9] = 96;
    const c = raceConsistency(laps(base, (n) => ({ pit_status: n === 5 ? 1 : 0, sc_status: n === 9 ? 1 : 0, current_tyre_compound: n > 5 ? "Hard" : "Medium" })));
    expect(c.excluded.map((e) => e.lap)).toEqual([1, 5, 6, 9, 10]);
    expect(c.score).toBeGreaterThan(99);
  });

  it("flags a lap more than 1 s off the stint trend as a mistake", () => {
    const t = Array.from({ length: 12 }, () => 90);
    t[6] = 92;
    expect(raceConsistency(laps(t)).mistakeLaps).toEqual([7]);
  });
});

describe("debrief facts", () => {
  it("counts pitting and in-pits status for the same stop once", () => {
    const data = laps([90, 90, 90, 90, 90, 90], (n) => ({
      pit_status: n === 2 ? 1 : n === 3 ? 2 : 0,
    }));
    const facts = buildDebriefFacts({ track_name: "Spa", category: "Race", lap_history: data });
    expect(verifiedPitLaps(data)).toEqual([2]);
    expect(splitStints(data)).toHaveLength(2);
    expect(facts.pit_laps).toEqual([2]);
    expect(facts.pit_stops).toBe(1);
  });
  it("does not split one recorded stop twice when the tyre compound changes", () => {
    const data = laps([90, 90, 110, 95, 94, 93], (n) => ({
      pit_status: n === 3 ? 1 : n === 4 ? 2 : 0,
      current_tyre_compound: n >= 4 ? "Hard" : "Medium",
    }));
    expect(verifiedPitLaps(data)).toEqual([3]);
    expect(splitStints(data).map((stint) => [stint[0].lap, stint.at(-1)?.lap])).toEqual([[1, 3], [4, 6]]);
    expect(buildDebriefFacts({ track_name: "Spa", category: "Race", lap_history: data }).pit_stops).toBe(1);
  });
  it("counts a continuous multi-lap pit-status signal as one stop", () => {
    const data = laps([90, 110, 109, 95, 94], (n) => ({
      pit_status: n === 2 || n === 3 ? 1 : n === 4 ? 2 : 0,
    }));
    expect(verifiedPitLaps(data)).toEqual([2]);
    expect(buildDebriefFacts({ track_name: "Spa", category: "Race", lap_history: data }).pit_stops).toBe(1);
  });
  it("still counts separate recorded stops independently", () => {
    const data = laps([90, 110, 95, 94, 110, 95, 94], (n) => ({
      pit_status: n === 2 || n === 5 ? 1 : n === 3 || n === 6 ? 2 : 0,
    }));
    expect(verifiedPitLaps(data)).toEqual([2, 5]);
    expect(buildDebriefFacts({ track_name: "Spa", category: "Race", lap_history: data }).pit_stops).toBe(2);
  });

  it("accepts exactly 108% as push pace, not slower cooldown laps", () => {
    expect(classifyQualifyingLaps(laps([100, 108, 108.001])).map((l) => l.role)).toEqual(["push", "push", "cooldown/recharge"]);
  });
  it("uses pit evidence for in/out laps and does not evaluate invalid laps", () => {
    expect(classifyQualifyingLaps(laps([120, 115, 100, 105], (n) => ({ pit_status: n === 1 ? 2 : 0, invalid: n === 4 }))).map((l) => l.role)).toEqual(["in-lap", "out-lap", "push", "invalid"]);
  });
  it("ignores the Melbourne single-lap Hard artifact", () => {
    const data = laps([90, 90, 90, 90, 90], (n) => ({ current_tyre_compound: n === 3 ? "Hard" : "Medium" }));
    expect(splitStints(data)).toHaveLength(1);
    expect(verifiedPitLaps(data)).toEqual([]);
    expect(buildDebriefFacts({ track_name: "Melbourne", category: "Race", lap_history: data }).stints[0].compound).toBe("Medium");
  });
  it("accepts sustained compound changes and recorded pit_status 1", () => {
    expect(verifiedPitLaps(laps([90, 90, 90, 90], (n) => ({ current_tyre_compound: n >= 3 ? "Hard" : "Medium" })))).toEqual([2]);
    expect(verifiedPitLaps(laps([90, 90, 90], (n) => ({ pit_status: n === 2 ? 1 : 0 })))).toEqual([2]);
  });
  it("summarises quali gaps to pole by sector", () => {
    const f = buildDebriefFacts({
      track_name: "Spa", category: "Qualifying", session_type: "Q3", driver_name: "FELEDZIAK",
      results: [
        { name: "VERSTAPPEN", position: 1, best_lap: "1:41.000", s1: "30.000", s2: "45.000", s3: "26.000" },
        { name: "FELEDZIAK", position: 2, best_lap: "1:41.300", s1: "30.100", s2: "45.000", s3: "26.200" },
      ],
    });
    expect((f.quali as any).gap_to_pole_s).toBe(0.3);
    expect((f.quali as any).sector_gap_to_pole_s).toEqual([0.1, 0, 0.2]);
    expect(f.consistency).toBeNull();
  });
  it("gives the debrief lap-numbered pace and sector evidence", () => {
    const data = laps([90, 91, 89, 90], (n) => ({
      s1: `${29 + n / 1000}`,
      s2: "30.000",
      s3: "30.000",
    }));
    const facts = buildDebriefFacts({ track_name: "Spa", category: "Race", lap_history: data });
    expect(facts.lap_pace.best_clean_lap).toEqual({ lap: 3, time_s: 89 });
    expect(facts.lap_pace.slowest_clean_lap).toEqual({ lap: 2, time_s: 91 });
    expect(facts.lap_pace.best_sectors).toHaveProperty("s1");
    expect(facts.lap_pace.best_sectors).toHaveProperty("s2");
    expect(facts.lap_pace.best_sectors).toHaveProperty("s3");
    expect(facts.lap_pace.best_sectors.s1).toEqual({ lap: 2, time_s: 29.002 });
  });
});
