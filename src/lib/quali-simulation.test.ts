import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { lapProgress, pointOnLine, replayPair } from "./quali-simulation";

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
});