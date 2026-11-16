import { describe, test } from "vitest";
import { strict as assert } from "node:assert";
import { driverProfileImage, DRIVER_PROFILE_PLACEHOLDER } from "./profile-images";

describe("season driver profile images", () => {
  const albonPhoto = "/images/drivers/albon.png";

  test("uses provided portraits in season two", () => {
    assert.equal(driverProfileImage("Albon", 2), albonPhoto);
  });

  test("reuses a season-two portrait in season one only when the team did not change", () => {
    assert.equal(
      driverProfileImage("ALBON", 1, [
        { season: 1, team: "Williams 2025" },
        { season: 2, team: "Williams 2026" },
      ]),
      albonPhoto,
    );
    assert.equal(
      driverProfileImage("ALBON", 1, [
        { season: 1, team: "Williams" },
        { season: 2, team: "Red Bull Racing" },
      ]),
      DRIVER_PROFILE_PLACEHOLDER,
    );
  });

  test("uses the placeholder for missing portraits and other seasons", () => {
    assert.equal(driverProfileImage("VERSTAPPEN", 2), DRIVER_PROFILE_PLACEHOLDER);
    assert.equal(driverProfileImage("ALBON", 3), DRIVER_PROFILE_PLACEHOLDER);
  });
});
