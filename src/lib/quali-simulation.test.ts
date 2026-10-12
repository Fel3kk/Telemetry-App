import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { lapProgress, liveGap, pointOnLine, replayPair } from "./quali-simulation";

describe("qualifying comparison", () => {
  const results = [
    { name: "LEADER", position: 1, best_lap: "1:20.000" },
    { name: "SECOND", position: 2, best_lap: "1:20.500" },
    { name: "PLAYER", position: 5, best_lap: "1:21.250" },
  ];
  test("the player is compared with P1", () => {
    assert.equal(replayPair(results, "player")?.rival.name, "LEADER");
  });
  test("when the player takes pole the other dot is P2", () => {
    assert.equal(replayPair(results, "LEADER")?.rival.name, "SECOND");
  });
  test("missing pole time is not replaced with an unrelated driver", () => {
    assert.equal(replayPair(results.slice(1), "PLAYER"), null);
  });
  test("both dots use their own lap time and stop at the finish", () => {
    assert.equal(lapProgress(40,80), 0.5);
    assert.equal(lapProgress(100,80), 1);
  });
  test("the racing line closes at the starting point", () => {
    const line = [{x:0,y:0},{x:1,y:0},{x:1,y:1}];
    assert.deepEqual(pointOnLine(line,1), line[0]);
  });
  test("sector times pace each third of the lap", () => {
    assert.equal(lapProgress(20, 60, [20, 10, 30]), 1 / 3);
    assert.equal(lapProgress(30, 60, [20, 10, 30]), 2 / 3);
  });
  test("live gap shows the player 0.5s behind halfway when sectors are equal pace", () => {
    const p = { name: "P", position: 2, lap: 81 };
    const r = { name: "R", position: 1, lap: 80 };
    assert.ok(Math.abs(liveGap(40.5, p, r) - 0.5) < 1e-9);
  });
});