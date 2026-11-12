import { loadTrackData, saveTrackData } from "./track-cloud";
import { PROFILE_VERSION, solveSpeedProfile, type SpeedProfile } from "./quali-physics";
import type { Point, ReplayDriver } from "./quali-simulation";

export type SolvedSimulation = { fingerprint: string; player: SpeedProfile; rival: SpeedProfile };
const pending = new Map<string, Promise<SolvedSimulation>>();
const memory = new Map<string, SolvedSimulation>();
const prefix = "f1.quali.sim.v2.";
function validProfile(value: unknown): value is SpeedProfile {
  if (!value || typeof value !== "object") return false;
  const p = value as SpeedProfile;
  return (
    p.version === PROFILE_VERSION &&
    p.lap > 0 &&
    p.times?.length === 121 &&
    p.times.every((t, i) => Number.isFinite(t) && (i === 0 ? t === 0 : t > p.times[i - 1])) &&
    p.times[120] === p.lap &&
    p.speeds?.length === 120 &&
    p.speeds.every((n) => Number.isFinite(n) && n > 0) &&
    p.points?.length === 120 &&
    p.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)) &&
    Array.isArray(p.corners) &&
    p.corners.every((i) => Number.isInteger(i) && i >= 0 && i < 120)
  );
}
function valid(value: unknown, fingerprint: string): value is SolvedSimulation {
  if (!value || typeof value !== "object") return false;
  const item = value as SolvedSimulation;
  return item.fingerprint === fingerprint && validProfile(item.player) && validProfile(item.rival);
}

/** Local profiles are namespaced by account; cloud reads/writes are owner-scoped. */
export function getSolvedSimulation({
  fingerprint,
  owner,
  line,
  track,
  player,
  rival,
  onSync,
}: {
  fingerprint: string;
  owner: string | null;
  line: Point[];
  track: string;
  player: ReplayDriver;
  rival: ReplayDriver;
  onSync?: (message: string) => void;
}): Promise<SolvedSimulation> {
  const key = `${owner ?? "guest"}:${fingerprint}`;
  let deviceStorageFailed = false;
  const sync = (profile: SolvedSimulation) => {
    if (!owner) {
      if (deviceStorageFailed)
        onSync?.("Simulation is ready, but browser storage could not save the replay.");
      return;
    }
    void saveTrackData("quali_sim", fingerprint, profile)
      .then((ok) => {
        const message = ok
          ? "Simulation saved to your account."
          : "Simulation cached on this device only.";
        onSync?.(
          deviceStorageFailed ? `${message} Browser storage could not save a local copy.` : message,
        );
      })
      .catch(() =>
        onSync?.(
          deviceStorageFailed
            ? "Browser storage and account sync failed; the simulation is available for this visit only."
            : "Simulation cached on this device; account sync is unavailable.",
        ),
      );
  };
  const cached = memory.get(key);
  if (cached) {
    try {
      window.localStorage.setItem(prefix + key, JSON.stringify(cached));
    } catch {
      deviceStorageFailed = true;
    }
    sync(cached);
    return Promise.resolve(cached);
  }
  try {
    const local: unknown = JSON.parse(window.localStorage.getItem(prefix + key) ?? "null");
    if (valid(local, fingerprint)) {
      memory.set(key, local);
      sync(local);
      return Promise.resolve(local);
    }
  } catch {
    deviceStorageFailed = true;
  }
  const existing = pending.get(key);
  if (existing) return existing;
  const job = (async () => {
    let cloud: unknown = null;
    if (owner) {
      try {
        cloud = await loadTrackData("quali_sim", fingerprint);
      } catch {
        /* Local solving remains available. */
      }
    }
    const profile: SolvedSimulation = valid(cloud, fingerprint)
      ? cloud
      : {
          fingerprint,
          player: solveSpeedProfile(line, player, track),
          rival: solveSpeedProfile(line, rival, track),
        };
    memory.set(key, profile);
    try {
      window.localStorage.setItem(prefix + key, JSON.stringify(profile));
    } catch {
      deviceStorageFailed = true;
    }
    if (!valid(cloud, fingerprint)) sync(profile);
    else onSync?.("Simulation loaded from your account.");
    return profile;
  })();
  pending.set(key, job);
  void job.finally(() => pending.delete(key)).catch(() => {});
  return job;
}
