import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

// Exercise the legacy analyzer's real lookup functions, not a separate copy.
const script = readFileSync(new URL("../../public/app/script.js", import.meta.url), "utf8");
const lookupCode = script.slice(script.indexOf("function canonicalTeam(t)"), script.indexOf("// Sector times"));
function lookup() {
  const context = vm.createContext({
    currentSeason: 2,
    allSessions: [
      { season: 3, results: [{ name: "PIOTR FELEDZIAK", team: "Aston Martin 26" }] },
      { season: 2, results: [{ name: "PIOTR FELEDZIAK", team: "Williams 26" }] },
    ],
  });
  vm.runInContext(lookupCode, context);
  return (expression: string) => vm.runInContext(expression, context);
}

describe("session constructor lookup", () => {
  it("uses Feledziak's Williams file before an Aston Martin saved assignment", () => {
    expect(lookup()(`teamForDriver({ "PIOTR FELEDZIAK": "Aston Martin" }, "PIOTR FELEDZIAK", 2, "Williams 26")`)).toBe("Williams");
  });
  it("keeps the same driver's fallback constructor separate for seasons 2 and 3", () => {
    const run = lookup();
    expect(run(`teamForDriver({}, "Piotr Feledziak", 2)`)).toBe("Williams");
    expect(run(`teamForDriver({}, "Piotr Feledziak", 3)`)).toBe("Aston Martin");
    expect(run(`teamForDriver({}, "Piotr Feledziak", 1)`)).toBe("");
  });
  it("reads replaced telemetry even when the number of sessions stays unchanged", () => {
    const run = lookup();
    expect(run(`teamFromTelemetry("PIOTR FELEDZIAK", 2)`)).toBe("Williams");
    run(`allSessions[1].results[0].team = "Ferrari"`);
    expect(run(`teamFromTelemetry("PIOTR FELEDZIAK", 2)`)).toBe("Ferrari");
  });
});