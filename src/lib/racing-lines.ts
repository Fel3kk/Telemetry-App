import collection from "@/data/racing-lines.json";
import { trackSlug } from "./f1-shell";
import type { Point } from "./quali-simulation";

export type RacingLineCollection = { version: 1; tracks: Record<string, Point[]> };

export function validRacingLine(value: unknown): value is Point[] {
  return Array.isArray(value) && value.length >= 3 && value.every((point) =>
    point && Number.isFinite(point.x) && Number.isFinite(point.y) &&
    point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1);
}

export function validGeneratedRacingLine(value: unknown): value is Point[] {
  return Array.isArray(value) && value.length >= 20 && value.length <= 160 && validRacingLine(value);
}

/** Published site data only: device-local lines can never override this collection. */
export function sharedRacingLine(track: string, source: unknown = collection): Point[] {
  if (!source || typeof source !== "object" || !("tracks" in source)) return [];
  const tracks = source.tracks;
  if (!tracks || typeof tracks !== "object") return [];
  const points = (tracks as Record<string, unknown>)[trackSlug(track)];
  return validRacingLine(points) ? points.map((point) => ({ ...point })) : [];
}

export function racingLineCollectionWith(track: string, points: Point[], source: unknown = collection): RacingLineCollection {
  if (!validRacingLine(points)) throw new Error("A racing line needs at least three normalized points.");
  const tracks: Record<string, Point[]> = {};
  if (source && typeof source === "object" && "tracks" in source) {
    const savedTracks = source.tracks;
    if (savedTracks && typeof savedTracks === "object") {
      for (const [slug, line] of Object.entries(savedTracks)) {
        if (!validRacingLine(line)) throw new Error(`The published racing line for ${slug} is invalid.`);
        tracks[slug] = line.map((point) => ({ ...point }));
      }
    }
  }
  tracks[trackSlug(track)] = points.map((point) => ({ ...point }));
  return { version: 1, tracks };
}

export function downloadRacingLineCollection(track: string, points: Point[]): void {
  if (!validRacingLine(points)) throw new Error("A racing line needs at least three normalized points.");
  if (typeof document === "undefined") throw new Error("The shared racing-line collection can only be downloaded in a browser.");
  const blob = new Blob([JSON.stringify(racingLineCollectionWith(track, points), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "racing-lines.json";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Read-only migration export. No upload or publication endpoint exists in the app. */
export function exportDeviceRacingLines(storage: Pick<Storage, "length" | "key" | "getItem">): RacingLineCollection {
  const tracks: Record<string, Point[]> = {};
  const prefix = "f1.quali.line.v1.";
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(prefix)) continue;
    try {
      const points: unknown = JSON.parse(storage.getItem(key) ?? "null");
      if (validRacingLine(points)) tracks[trackSlug(key.slice(prefix.length))] = points;
    } catch { /* Preserve other lines when one old entry is corrupt. */ }
  }
  return { version: 1, tracks };
}