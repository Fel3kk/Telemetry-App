import { describe, expect, test } from "bun:test";
import { lapProgress, pointOnLine, replayPair } from "./quali-simulation";

describe("qualifying comparison", () => {
  const results = [
    { name: "LEADER", position: 1, best_lap: "1:20.000" },
    { name: "SECOND", position: 2, best_lap: "1:20.500" },
    { name: "PLAYER", position: 5, best_lap: "1:21.250" },
  ];
  test("the player is compared with P1", () => {
    expect(replayPair(results, "player")?.rival.name).toBe("LEADER");
  });
  test("when the player takes pole the other dot is P2", () => {
    expect(replayPair(results, "LEADER")?.rival.name).toBe("SECOND");
  });
  test("missing pole time is not replaced with an unrelated driver", () => {
    expect(replayPair(results.slice(1), "PLAYER")).toBeNull();
  });
  test("both dots use their own lap time and stop at the finish", () => {
    expect(lapProgress(40,80)).toBe(0.5);
    expect(lapProgress(100,80)).toBe(1);
  });
  test("the racing line closes at the starting point", () => {
    const line = [{x:0,y:0},{x:1,y:0},{x:1,y:1}];
    expect(pointOnLine(line,1)).toEqual(line[0]);
  });
});