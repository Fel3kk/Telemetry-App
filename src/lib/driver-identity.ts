import "../../public/app/identity.js";

export const { normalizeDriver, driverMatches, canonicalTeam } = globalThis.F1Identity;

/** Prefer an exact identity before accepting a surname-only alias. */
export function resolveDriverName(value: unknown, names: string[]): string {
  const name = normalizeDriver(value);
  return names.find((n) => normalizeDriver(n) === name) ??
    names.find((n) => driverMatches(n, name)) ?? name;
}