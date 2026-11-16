import { describe, expect, it } from "vitest";
import { buildDebriefFacts } from "./race-debrief";

const laps = (n: number, base: number) =>
  Array.from({ length: n }, (_, i) => ({ lap: i + 1, lap_time: base + (i % 3) * 0.1, current_tyre_compound: "Medium" }));

describe("debrief field data", () => {
  it("includes every other driver's lap times, not just the 6 nearest", () => {
    const others = Array.from({ length: 12 }, (_, i) => ({ name: `D${i}`, position: i + 1, lap_history: laps(10, 90 + i) }));
    const f = buildDebriefFacts({ track_name: "Monza", category: "Race", driver_name: "Me", finishing_position: 5, lap_history: laps(10, 91) as never, other_driver_lap_histories: others as never });
    expect(f.driver_lap_comparisons).toHaveLength(12);
    expect(f.driver_lap_comparisons[11].lap_times_s).toHaveLength(10);
  });
});
