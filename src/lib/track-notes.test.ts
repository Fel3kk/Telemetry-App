import { describe, expect, it } from "vitest";
import { parseTrackNotes } from "./track-notes";

describe("parseTrackNotes", () => {
  it("formats tyre and battery labels as readable rows", () => {
    expect(
      parseTrackNotes(
        "SOFTS: 8-10 Laps\n\nMEDIUMS: 10-14 Laps\nHARDS: 20 Laps\nBATTERY MANAGEMENT: NOT A LOT NEEDED",
      ),
    ).toEqual([
      { label: "Softs", value: "8-10 Laps" },
      { label: "Mediums", value: "10-14 Laps" },
      { label: "Hards", value: "20 Laps" },
      { label: "Battery Management", value: "NOT A LOT NEEDED" },
    ]);
  });

  it("keeps multiline values and unlabelled notes without truncation", () => {
    expect(parseTrackNotes("Use lift and coast\nSOFTS:\nCheck wear on exits")).toEqual([
      { label: "Notes", value: "Use lift and coast" },
      { label: "Softs", value: "Check wear on exits" },
    ]);
  });
});
