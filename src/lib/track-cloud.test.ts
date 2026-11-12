import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ getSession: vi.fn(), upsert: vi.fn(), maybeSingle: vi.fn() }));
vi.mock("./supabase", () => ({ supabase: {
  auth: { getSession: db.getSession },
  from: () => ({ upsert: db.upsert, select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: db.maybeSingle }) }) }) }) }),
} }));
import { loadTrackData, saveTrackData } from "./track-cloud";

describe("account track saving", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.getSession.mockResolvedValue({ data: { session: { user: { id: "driver-1" } } } });
    db.upsert.mockResolvedValue({ error: null });
  });
  it("saves one owner-scoped track independent of season and reads it back", async () => {
    const map = { version: 1, modes: { race: [] }, palette: [] };
    db.maybeSingle.mockResolvedValue({ data: { data: { palette: [], modes: { race: [] }, version: 1 } }, error: null });
    expect(await saveTrackData("ers", "melbourne", map)).toBe(true);
    expect(db.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "driver-1", kind: "ers", track_slug: "melbourne", data: map }), { onConflict: "user_id,kind,track_slug" });
    expect(await loadTrackData("ers", "melbourne")).toEqual(map);
  });
  it("does not confirm a save when the read-back differs", async () => {
    db.maybeSingle.mockResolvedValue({ data: { data: [] }, error: null });
    await expect(saveTrackData("racing_line", "melbourne", [{ x: 0.1, y: 0.2 }])).rejects.toThrow("could not be verified");
  });
  it("does not write without a signed-in owner", async () => {
    db.getSession.mockResolvedValue({ data: { session: null } });
    expect(await saveTrackData("ers", "melbourne", {})).toBe(false);
    expect(db.upsert).not.toHaveBeenCalled();
  });
});