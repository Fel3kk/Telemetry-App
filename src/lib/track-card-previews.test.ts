import { describe, expect, it } from "vitest";
import { buildTrackCardPreview, formatPreviewLapTime } from "./track-card-previews";

describe("track card previews", () => {
  it("derives summaries from saved race story and stint data", () => {
    const preview = buildTrackCardPreview({
      driver_name: "Alex Albon",
      starting_position: 5,
      finishing_position: 3,
      stints: [
        { "start-lap": 1, "end-lap": 12, "tyre-set-data": { "visual-tyre-compound": "Soft" } },
      ],
      race_story: {
        player_name: "ALBON",
        position_history: [
          { lap: 0, position: 5 },
          { lap: 10, position: 3 },
        ],
        pace_delta: [{ delta_ms: 100 }, { delta_ms: -50 }, { delta_ms: 0 }],
        driver_lap_times: [
          {
            name: "ALBON",
            laps: [
              { lap: 1, ms: 90_000 },
              { lap: 2, ms: 89_000 },
              { lap: 3, ms: 88_000, valid: false },
            ],
          },
          {
            name: "VERSTAPPEN",
            laps: [
              { lap: 1, ms: 89_500 },
              { lap: 2, ms: 89_200 },
            ],
          },
        ],
      },
    });

    expect(preview.positions).toEqual({ start: 5, finish: 3 });
    expect(preview.stints).toEqual([{ compound: "Soft", startLap: 1, endLap: 12, laps: 12 }]);
    expect(preview.laps).toEqual([
      { lap: 1, ms: 90_000 },
      { lap: 2, ms: 89_000 },
    ]);
    expect(preview.bestLapMs).toBe(89_000);
    expect(preview.averageLapMs).toBe(89_500);
    expect(preview.fastestRival).toEqual({ name: "VERSTAPPEN", ms: 89_200 });
    expect(preview.medianPaceDeltaMs).toBe(0);
  });

  it("returns empty values when a session has no preview telemetry", () => {
    const preview = buildTrackCardPreview(null);

    expect(preview.positions).toBeNull();
    expect(preview.stints).toEqual([]);
    expect(preview.laps).toEqual([]);
    expect(preview.fastestRival).toBeNull();
    expect(preview.bestLapMs).toBeNull();
    expect(preview.averageLapMs).toBeNull();
    expect(preview.medianPaceDeltaMs).toBeNull();
  });

  it("formats recorded lap times as minutes and seconds", () => {
    expect(formatPreviewLapTime(92_345)).toBe("1:32.345");
    expect(formatPreviewLapTime(null)).toBe("—");
  });
});
