import { canonicalTeam, normalizeDriver } from "@/lib/driver-identity";
import type { DriverTeamHistorySeason } from "@/lib/f1-stats";

export const DRIVER_PROFILE_PLACEHOLDER = "/images/driver-placeholder.svg";
export const TEAM_LOGO_PLACEHOLDER = "/images/team-placeholder.svg";

const SEASON_2_DRIVER_PROFILE_IMAGES: Readonly<Record<string, string>> = {
  ALBON: "/images/drivers/albon.png",
  ALONSO: "/images/drivers/alonso.png",
  ANTONELLI: "/images/drivers/antonelli.png",
  BEARMAN: "/images/drivers/bearman.png",
  BORTOLETO: "/images/drivers/bortoleto.png",
  BOTTAS: "/images/drivers/bottas.png",
  COLAPINTO: "/images/drivers/colapinto.png",
  FELEDZIAK: "/images/drivers/feledziak.png",
  "PIOTR FELEDZIAK": "/images/drivers/feledziak.png",
  GASLY: "/images/drivers/gasly.png",
  HADJAR: "/images/drivers/hadjar.png",
  HAMILTON: "/images/drivers/hamilton.png",
  HULKENBERG: "/images/drivers/hulkenberg.png",
  LAWSON: "/images/drivers/lawson.png",
  LECLERC: "/images/drivers/leclerc.png",
  LINDBLAD: "/images/drivers/lindblad.png",
  NORRIS: "/images/drivers/norris.png",
  OCON: "/images/drivers/ocon.png",
  PEREZ: "/images/drivers/perez.png",
  PÉREZ: "/images/drivers/perez.png",
  PIASTRI: "/images/drivers/piastri.png",
  RUSSELL: "/images/drivers/russell.png",
  SAINZ: "/images/drivers/sainz.png",
  STROLL: "/images/drivers/stroll.png",
};
export const TEAM_LOGOS: Readonly<Record<string, string>> = {};

export function driverProfileImage(
  name: string,
  season: number,
  teamHistory: readonly DriverTeamHistorySeason[] = [],
): string {
  const image = SEASON_2_DRIVER_PROFILE_IMAGES[normalizeDriver(name)];
  if (!image) return DRIVER_PROFILE_PLACEHOLDER;
  if (season === 2) return image;
  if (season !== 1) return DRIVER_PROFILE_PLACEHOLDER;

  const teamInSeasonOne = teamHistory.find((entry) => entry.season === 1)?.team;
  const teamInSeasonTwo = teamHistory.find((entry) => entry.season === 2)?.team;
  if (
    !teamInSeasonOne ||
    !teamInSeasonTwo ||
    canonicalTeam(teamInSeasonOne) !== canonicalTeam(teamInSeasonTwo)
  ) {
    return DRIVER_PROFILE_PLACEHOLDER;
  }
  return image;
}

export function teamLogo(team: string): string {
  return TEAM_LOGOS[canonicalTeam(team)] ?? TEAM_LOGO_PLACEHOLDER;
}
