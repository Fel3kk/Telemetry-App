// Career slots: 3 "Driver career" slots + 3 "My Team career" slots.
// The active slot is stored per-browser and every uploaded session is tagged
// with it (telemetry_sessions.career_slot), so each slot has its own data.

export type CareerType = "driver" | "team";
export type CareerSlot = { type: CareerType; index: number; id: string; label: string };

export const CAREER_KEY = "f1.career";

export function slotId(type: CareerType, index: number) {
  return `${type}-${index}`;
}

export function slotLabel(type: CareerType, index: number) {
  return `${type === "driver" ? "Driver" : "My Team"} · Slot ${index}`;
}

export const CAREER_SLOTS: CareerSlot[] = (["driver", "team"] as CareerType[]).flatMap((type) =>
  [1, 2, 3].map((index) => ({
    type,
    index,
    id: slotId(type, index),
    label: slotLabel(type, index),
  })),
);

export function parseSlot(id: string | null | undefined): CareerSlot | null {
  if (!id) return null;
  return CAREER_SLOTS.find((s) => s.id === id) ?? null;
}

export function getActiveCareer(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return parseSlot(window.localStorage.getItem(CAREER_KEY))?.id ?? null;
  } catch {
    return null;
  }
}

export function setActiveCareer(id: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CAREER_KEY, id);
  } catch {}
}

export function clearActiveCareer() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CAREER_KEY);
  } catch {}
}

export function activeCareerLabel(): string {
  const id = getActiveCareer();
  return id ? careerLabel(id) : "No career";
}

// ---- Custom slot names -------------------------------------------------
// Names live in Supabase (career_slot_names) and are mirrored to
// localStorage so the header chip can render instantly / offline.
export const CAREER_NAMES_KEY = "f1.career.names";

export function getCareerNames(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CAREER_NAMES_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function setCareerNames(map: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CAREER_NAMES_KEY, JSON.stringify(map));
  } catch {}
}

export function careerLabel(id: string): string {
  const slot = parseSlot(id);
  if (!slot) return "No career";
  const custom = getCareerNames()[id];
  return custom?.trim() ? custom.trim() : slot.label;
}
