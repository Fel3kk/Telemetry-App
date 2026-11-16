import { describe, test } from "vitest";
import { strict as assert } from "node:assert";
import {
  GP_MAX_POINTS,
  SPRINT_MAX_POINTS,
  computeStandings,
  computeConstructorStandings,
  computeTitleMath,
  hasClinchedTitle,
  seasonDriverProfiles,
  allTimeDriverProfiles,
  allTimeConstructorProfiles,
  driverTeamHistories,
  loadExcludedTracks,
  saveExcludedTracks,
} from "./f1-stats";
import type { Session } from "./f1-shell";

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "session",
    season: 1,
    track_name: "Melbourne",
    category: "Race",
    finishing_position: null,
    starting_position: null,
    created_at: "2026-01-01",
    ...overrides,
  };
}

describe("title race max points", () => {
  test("a Grand Prix is worth 25 max (no fastest-lap point)", () => {
    assert.equal(GP_MAX_POINTS, 25);
  });
  test("sprint weekends add 8 on top", () => {
    assert.equal(SPRINT_MAX_POINTS, 8);
    const m = computeTitleMath([], 1, { sprints: new Set(["miami"]) });
    assert.equal(m.maxPointsLeft, m.racesLeft * 25 + 8);
  });

  test("a fastest lap does not add a point to the title total", () => {
    const standings = computeStandings([
      makeSession({
        season: 1,
        session_type: "Race",
        race_story: {
          classification: [
            { name: "ALICE", position: 1, status: "FINISHED" },
            { name: "BOB", position: 2, status: "FINISHED" },
          ],
          starting_grid: [{ name: "BOB", position: 1 }],
          fastest_lap: { name: "ALICE" },
        },
      }),
    ]);

    assert.equal(standings.find((driver) => driver.name === "ALICE")?.points, 25);
    assert.equal(standings.find((driver) => driver.name === "ALICE")?.fastestLaps, 1);
    assert.equal(standings.find((driver) => driver.name === "BOB")?.gpPoles, 1);
  });

  test("the current leader is a champion only when nobody can catch them", () => {
    const standings = computeStandings([
      makeSession({
        season: 1,
        session_type: "Race",
        race_story: {
          classification: [
            { name: "ALICE", position: 1, status: "FINISHED" },
            { name: "BOB", position: 2, status: "FINISHED" },
          ],
        },
      }),
    ]);

    assert.equal(hasClinchedTitle(standings, 6), true);
    assert.equal(hasClinchedTitle(standings, 7), false);
  });

  test("a sole classified driver cannot clinch while points remain available", () => {
    const standings = computeStandings([
      makeSession({
        season: 1,
        session_type: "Race",
        race_story: {
          classification: [{ name: "ALICE", position: 1, status: "FINISHED" }],
        },
      }),
    ]);

    assert.equal(hasClinchedTitle(standings, 25), false);
    assert.equal(hasClinchedTitle(standings, 0), true);
  });
});

describe("title race calendar persistence", () => {
  test("excluded tracks are isolated by season", () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });

    try {
      saveExcludedTracks(new Set(["melbourne"]), 1);
      saveExcludedTracks(new Set(["shanghai"]), 2);
      assert.deepEqual([...loadExcludedTracks(1)], ["melbourne"]);
      assert.deepEqual([...loadExcludedTracks(2)], ["shanghai"]);
    } finally {
      if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
      else delete (globalThis as { localStorage?: Storage }).localStorage;
    }
  });
});

describe("title race finds the player", () => {
  const race = (name: string, created_at: string): Session =>
    makeSession({
      season: 2,
      category: "Race",
      session_type: "Race",
      track_name: "Melbourne",
      created_at,
      driver_name: name,
      race_story: {
        player_name: name,
        classification: [
          { name, team: "Williams", position: 1, status: "FINISHED" },
          { name: "BOTTAS", team: "Cadillac", position: 2, status: "FINISHED" },
        ],
      },
    });
  test("a practice file without a driver name does not hide the player", () => {
    const sessions: Session[] = [
      race("Feledziak", "2026-01-01"),
      makeSession({
        season: 2,
        category: "Practice",
        session_type: "Practice 1",
        track_name: "Shanghai",
        created_at: "2026-01-02",
      }),
    ];
    const m = computeTitleMath(sessions, 2);
    assert.equal(m.player?.name, "FELEDZIAK");
    assert.equal(m.player?.points, 25);
    assert.equal(m.leader?.name, "FELEDZIAK");
  });
});

describe("driver season and career profiles", () => {
  test("profiles include race, sprint, qualifying, and career stats for every classified driver", () => {
    const sessions = [
      makeSession({
        driver_name: "ALICE",
        session_type: "Race",
        category: "Race",
        finishing_position: 2,
        starting_position: 1,
        race_story: {
          player_name: "ALICE",
          classification: [
            { name: "ALICE", team: "Team A", position: 2, status: "FINISHED", laps: 57 },
            { name: "BOB", team: "Team B", position: 1, status: "FINISHED", laps: 58 },
          ],
          starting_grid: [
            { name: "ALICE", position: 1 },
            { name: "BOB", position: 2 },
          ],
          fastest_lap: { name: "BOB" },
        },
      }),
      makeSession({
        driver_name: "ALICE",
        category: "Sprint",
        session_type: "Sprint",
        race_story: {
          player_name: "ALICE",
          classification: [
            { name: "ALICE", team: "Team A", position: 1, status: "FINISHED", laps: 19 },
            { name: "BOB", team: "Team B", position: 3, status: "FINISHED", laps: 19 },
          ],
          starting_grid: [
            { name: "ALICE", position: 2 },
            { name: "BOB", position: 1 },
          ],
        },
      }),
      makeSession({
        driver_name: "ALICE",
        category: "Qualifying",
        session_type: "Q1",
        finishing_position: 7,
        race_story: {
          player_name: "ALICE",
          classification: [
            { name: "ALICE", team: "Team A", position: 7 },
            { name: "BOB", team: "Team B", position: 11 },
          ],
        },
      }),
    ];

    const seasonProfiles = seasonDriverProfiles(sessions, 1);
    const bob = seasonProfiles.find((profile) => profile.name === "BOB");
    assert.ok(bob);
    assert.equal(bob.stats.championshipPos, 1);
    assert.equal(bob.stats.totalPoints, 31);
    assert.equal(bob.stats.starts, 2);
    assert.equal(bob.stats.wins, 1);
    assert.equal(bob.stats.podiums, 2);
    assert.equal(bob.stats.sprintPoles, 1);
    assert.equal(bob.stats.fastestLaps, 1);
    assert.equal(bob.stats.avgQuali, 11);
    assert.equal(bob.stats.q1Apps, 1);
    assert.equal(bob.stats.q2Apps, 1);

    const career = allTimeDriverProfiles(sessions);
    assert.equal(career[0].name, "BOB");
    assert.equal(career[0].stats.totalPoints, 31);
    assert.equal(career[0].seasonsActive, 1);
  });
});

describe("constructor career profiles", () => {
  test("aggregates points, wins, podiums, poles, and titles across normalized team names", () => {
    const sessions = [2025, 2026].map((season) =>
      makeSession({
        season,
        session_type: "Race",
        race_story: {
          classification: [
            { name: "ALICE", team: `Williams ${season}`, position: 1, status: "FINISHED" },
            { name: "BOB", team: `Williams ${season}`, position: 2, status: "FINISHED" },
            { name: "CAROL", team: `Ferrari ${season}`, position: 3, status: "FINISHED" },
          ],
          starting_grid: [{ name: "ALICE", team: `Williams ${season}`, position: 1 }],
        },
      }),
    );

    const perSeason = computeConstructorStandings(
      sessions.filter((session) => session.season === 2025),
    );
    assert.deepEqual(perSeason[0], {
      team: "Williams",
      points: 43,
      wins: 1,
      podiums: 2,
      poles: 1,
    });

    const profiles = allTimeConstructorProfiles(sessions, new Map([["Williams", 2]]));
    assert.deepEqual(profiles[0], {
      team: "Williams",
      seasonsActive: 2,
      titles: 2,
      points: 86,
      wins: 2,
      podiums: 4,
      poles: 2,
    });
  });

  describe("driver team histories", () => {
    test("chooses one team per driver-season, preserves historical names, and sorts chronologically", () => {
      const sessions = [
        makeSession({
          season: 3,
          race_story: {
            classification: [
              { name: "Alice", team: "Aston Martin" },
              { name: "Bob", team: "McLaren" },
              { name: "Ghost", team: "Unassigned" },
            ],
          },
        }),
        makeSession({
          season: 1,
          race_story: {
            classification: [{ name: "ALICE", team: "Racing Point 2020" }],
          },
        }),
        makeSession({
          season: 2,
          race_story: {
            classification: [
              { name: "ALICE", team: "McLaren" },
              { name: "alice", team: "McLaren" },
              { name: "ALICE", team: "Aston Martin" },
            ],
          },
        }),
      ];

      assert.deepEqual(
        driverTeamHistories(sessions).find((history) => history.name === "ALICE"),
        {
          name: "ALICE",
          seasons: [
            { season: 1, team: "Racing Point" },
            { season: 2, team: "McLaren" },
            { season: 3, team: "Aston Martin" },
          ],
        },
      );
      assert.equal(
        driverTeamHistories(sessions).some((history) => history.name === "GHOST"),
        false,
      );
    });
  });
});
