import { describe, test } from "vitest";
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

describe("title race finds the player", () => {
  const race = (name: string, created_at: string) => ({
    season: 2, category: "Race", session_type: "Race", track_name: "Melbourne", created_at,
    driver_name: name,
    race_story: { player_name: name, classification: [
      { name, team: "Williams", position: 1, status: "FINISHED" },
      { name: "BOTTAS", team: "Cadillac", position: 2, status: "FINISHED" },
    ] },
  });
  test("a practice file without a driver name does not hide the player", () => {
    const sessions: any[] = [
      race("Feledziak", "2026-01-01"),
      { season: 2, category: "Practice", session_type: "Practice 1", track_name: "Shanghai", created_at: "2026-01-02" },
    ];
    const m = computeTitleMath(sessions, 2);
    assert.equal(m.player?.name, "FELEDZIAK");
    assert.equal(m.player?.points, 25);
    assert.equal(m.leader?.name, "FELEDZIAK");
  });
});
