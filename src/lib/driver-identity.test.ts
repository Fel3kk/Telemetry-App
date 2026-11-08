import { describe, expect, it } from "vitest";
import { canonicalTeam, driverMatches } from "./driver-identity";

describe("driver identity", () => {
  it("matches full and surname-only names in both directions", () => {
    expect(driverMatches("  Piotr   FELEDZIAK ", "feledziak")).toBe(true);
    expect(driverMatches("FELEDZIAK", "Piotr Feledziak")).toBe(true);
    expect(driverMatches("Alex Smith", "John Smith")).toBe(false);
    expect(driverMatches("", "")).toBe(false);
  });
  const aliases: Record<string, string[]> = {
    "Aston Martin": ["Aston Martin Aramco", "Aston Martin F1 Team", "Aston Martin '26"],
    "Red Bull": ["Oracle Red Bull Racing", "Red Bull Racing"],
    Mercedes: ["Mercedes-AMG PETRONAS", "Mercedes-AMG F1"],
    Ferrari: ["Scuderia Ferrari HP", "Ferrari '26"],
    McLaren: ["McLaren Formula 1 Team", "Mclaren '26"],
    Williams: ["Atlassian Williams", "Williams Racing"],
    "Racing Bulls": ["Visa Cash App RB", "Racing Bulls"],
    Haas: ["MoneyGram Haas", "Haas F1 Team"],
    Alpine: ["BWT Alpine", "Alpine F1 Team"],
    Audi: ["Stake F1 Team Kick Sauber", "Audi F1 Team"],
    Cadillac: ["Cadillac Formula 1 Team"],
  };
  for (const [team, values] of Object.entries(aliases)) {
    it(`resolves ${team} aliases`, () => {
      for (const value of values) expect(canonicalTeam(value)).toBe(team);
    });
  }
});