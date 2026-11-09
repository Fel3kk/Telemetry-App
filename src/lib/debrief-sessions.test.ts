import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { fetchDebriefSessions } from "./debrief-sessions";
import { buildDebriefFacts } from "./race-debrief";

describe("saved debrief sessions", () => {
  it("queries stored position columns and preserves the player's P7 to P10 result", async () => {
    let requested: URL | undefined;
    const client = createClient("https://sessions.example", "public-test-key", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async (input) => {
        requested = new URL(String(input));
        const columns = requested.searchParams.get("select")?.split(",") ?? [];
        const correct = columns.includes("starting_position:starting_pos") && columns.includes("finishing_position:finishing_pos");
        return Response.json(correct ? [{ id: "race-1", track_name: "Abu Dhabi", category: "Race", starting_position: 7, finishing_position: 10 }] : { message: "Unknown position column" }, { status: correct ? 200 : 400 });
      } },
    });
    const rows = await fetchDebriefSessions(client, { season: 2, career: "driver-1", track: "abu_dhabi", cat: "Race" });
    expect(requested?.searchParams.get("season")).toBe("eq.2");
    expect(requested?.searchParams.get("career_slot")).toBe("eq.driver-1");
    expect(rows).toHaveLength(1);
    expect(rows[0].starting_position).toBe(7);
    expect(rows[0].finishing_position).toBe(10);
    expect(buildDebriefFacts(rows[0])).toMatchObject({ grid: 7, finish: 10 });
  });

  it("does not disguise a failed request as an empty weekend", async () => {
    const client = createClient("https://sessions.example", "public-test-key", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async () => Response.json({ code: "42501", message: "Permission denied" }, { status: 403 }) },
    });
    await expect(fetchDebriefSessions(client, { season: 1, career: null, track: "spa", cat: "Race" })).rejects.toMatchObject({ code: "42501" });
  });
});