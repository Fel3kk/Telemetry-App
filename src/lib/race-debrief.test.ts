import { describe, expect, it } from "vitest";
import { raceConsistency, scoreFromSpread, buildDebriefFacts, splitStints, verifiedPitLaps, classifyQualifyingLaps, type DebriefLap } from "./race-debrief";

const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(3).padStart(6, "0")}`;
function laps(times: number[], extra: (i: number) => Partial<DebriefLap> = () => ({})): DebriefLap[] {
  return times.map((t, i) => ({ lap: i + 1, lap_time: fmt(t), current_tyre_compound: "Medium", pit_status: 0, sc_status: 0, ...extra(i + 1) }));
}

describe("race consistency", () => {
  it("scores the published reference points", () => {
    expect(scoreFromSpread(0.1)).toBeCloseTo(94.9, 0);
    expect(scoreFromSpread(0.3)).toBeCloseTo(78.1, 0);
    expect(scoreFromSpread(0.7)).toBe(50);
    expect(scoreFromSpread(1)).toBeCloseTo(37, 0);
  });

  it("does not punish steady fuel burn: laps 0.08 s quicker every lap score ~100", () => {
    const c = raceConsistency(laps(Array.from({ length: 20 }, (_, i) => 95 - i * 0.08)));
    expect(c.score).toBeGreaterThan(99);
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
  it("accepts sustained compound changes and recorded pit_status > 0", () => {
    expect(verifiedPitLaps(laps([90, 90, 90, 90], (n) => ({ current_tyre_compound: n >= 3 ? "Hard" : "Medium" })))).toEqual([2]);
    expect(verifiedPitLaps(laps([90, 90, 90], (n) => ({ pit_status: n === 2 ? 2 : 0 })))).toEqual([2]);
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
});
