export {};
declare global {
  var F1Identity: {
    normalizeDriver(value: unknown): string;
    driverMatches(a: unknown, b: unknown): boolean;
    canonicalTeam(value: unknown): string;
  };
}