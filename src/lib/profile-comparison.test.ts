import { describe, expect, it } from "vitest";
import { comparisonWinner } from "./profile-comparison";

describe("comparison winners", () => {
  it("selects the better side for higher- and lower-is-better metrics", () => {
    expect(comparisonWinner(12, 8, "higher")).toBe("left");
    expect(comparisonWinner(12, 8, "lower")).toBe("right");
  });

  it("does not highlight ties or missing values", () => {
    expect(comparisonWinner(4, 4, "higher")).toBeNull();
    expect(comparisonWinner(null, 4, "higher")).toBeNull();
  });
});
