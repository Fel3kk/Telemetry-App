(function (root) {
  const normalizeDriver = (value) => String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
  function driverMatches(a, b) {
    const x = normalizeDriver(a), y = normalizeDriver(b);
    if (!x || !y) return false;
    if (x === y) return true;
    // Surname shorthand is allowed; two distinct full names never merge.
    return (!x.includes(" ") || !y.includes(" ")) && x.split(" ").at(-1) === y.split(" ").at(-1);
  }
  function canonicalTeam(value) {
    const s = String(value ?? "").trim().replace(/[’']/g, "").replace(/[\s_-]*(?:19|20)?\d{2}\s*$/, "").replace(/\s+/g, " ").trim();
    const aliases = [
      [/aston martin/i, "Aston Martin"], [/red bull/i, "Red Bull"], [/mercedes/i, "Mercedes"],
      [/ferrari/i, "Ferrari"], [/mclaren/i, "McLaren"], [/williams/i, "Williams"],
      [/racing bulls|visa cash app|^rb$|alphatauri/i, "Racing Bulls"], [/haas/i, "Haas"],
      [/alpine/i, "Alpine"], [/sauber|audi/i, "Audi"], [/cadillac/i, "Cadillac"],
    ];
    return aliases.find(([pattern]) => pattern.test(s))?.[1] ?? s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
  }
  root.F1Identity = { normalizeDriver, driverMatches, canonicalTeam };
})(globalThis);