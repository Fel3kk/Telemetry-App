// Same rules as public/app/identity.js (used by the embedded app); kept as a module so
// React bundles never depend on that script having loaded.
export const normalizeDriver = (value: unknown) => String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase();

export function driverMatches(a: unknown, b: unknown) {
  const x = normalizeDriver(a), y = normalizeDriver(b);
  if (!x || !y) return false;
  if (x === y) return true;
  // Surname shorthand is allowed; two distinct full names never merge.
  return (!x.includes(" ") || !y.includes(" ")) && x.split(" ").at(-1) === y.split(" ").at(-1);
}

const ALIASES: [RegExp, string][] = [
  [/aston martin/i, "Aston Martin"], [/red bull/i, "Red Bull"], [/mercedes/i, "Mercedes"],
  [/ferrari/i, "Ferrari"], [/mclaren/i, "McLaren"], [/williams/i, "Williams"],
  [/racing bulls|visa cash app|^rb$|alphatauri/i, "Racing Bulls"], [/haas/i, "Haas"],
  [/alpine/i, "Alpine"], [/sauber|audi/i, "Audi"], [/cadillac/i, "Cadillac"],
];

export function canonicalTeam(value: unknown) {
  const s = String(value ?? "").trim().replace(/[’']/g, "").replace(/[\s_-]*(?:19|20)?\d{2}\s*$/, "").replace(/\s+/g, " ").trim();
  return ALIASES.find(([p]) => p.test(s))?.[1] ?? s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}
