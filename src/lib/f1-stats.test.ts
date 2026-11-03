import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { GP_MAX_POINTS, SPRINT_MAX_POINTS, computeTitleMath } from "./f1-stats";

describe("title race max points", () => {
  test("a Grand Prix is worth 25 max (no fastest-lap point)", () => {
    assert.equal(GP_MAX_POINTS, 25);
  });
  test("sprint weekends add 8 on top", () => {
    assert.equal(SPRINT_MAX_POINTS, 8);
    const m = computeTitleMath([], 1, { sprints: new Set(["miami"]) });
    assert.equal(m.maxPointsLeft, m.racesLeft * 25 + 8);
  });
});
