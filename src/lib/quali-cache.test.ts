import { beforeEach, describe, expect, it, vi } from "vitest";
const cloud = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }));
vi.mock("./track-cloud", () => ({ loadTrackData: cloud.load, saveTrackData: cloud.save }));
import { getSolvedSimulation } from "./quali-cache";
import { solveSpeedProfile } from "./quali-physics";
const line = [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 }, { x: 0.5, y: 0.9 }];
const player = { name: "P", position: 2, lap: 80 }, rival = { name: "R", position: 1, lap: 79 };
const input = { owner: "owner", track: "zandvoort", line, player, rival };
describe("solved simulation persistence", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal("window", { localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) } });
    cloud.load.mockReset().mockResolvedValue(null); cloud.save.mockReset().mockResolvedValue(true);
  });
  it("returns the same solved object on repeat visits without regeneration", async () => {
    const a = await getSolvedSimulation({ ...input, fingerprint: "repeat" });
    const b = await getSolvedSimulation({ ...input, fingerprint: "repeat" });
    expect(b).toBe(a); expect(cloud.load).toHaveBeenCalledTimes(1);
  });
  it("loads an existing cloud solution and caches it locally without solving again", async () => {
    const solved = { fingerprint: "cloud", player: solveSpeedProfile(line, player, "zandvoort"), rival: solveSpeedProfile(line, rival, "zandvoort") };
    cloud.load.mockResolvedValue(solved);
    const result = await getSolvedSimulation({ ...input, fingerprint: "cloud" });
    expect(result).toBe(solved); expect(cloud.save).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("f1.quali.sim.v1.owner:cloud")).toContain('"fingerprint":"cloud"');
  });
  it("keeps device caches separate between accounts", async () => {
    await getSolvedSimulation({ ...input, fingerprint: "separate", owner: "one" });
    await getSolvedSimulation({ ...input, fingerprint: "separate", owner: "two" });
    expect(cloud.load).toHaveBeenCalledTimes(2);
  });
  it("continues playback and reports an account sync failure", async () => {
    cloud.save.mockRejectedValue(new Error("missing storage"));
    const notice = vi.fn();
    const result = await getSolvedSimulation({ ...input, fingerprint: "failure", onSync: notice });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(result.player.lap).toBe(80);
    expect(notice).toHaveBeenCalledWith("Simulation cached on this device; account sync is unavailable.");
  });
});