import { useMemo, useState } from "react";
import type { DriverProfile } from "@/components/f1/DriverProfileDialog";
import { canonicalTeam } from "@/lib/driver-identity";

const TEAM_COLORS: Record<string, string> = {
  Mercedes: "#27f4d2",
  Ferrari: "#f91536",
  "Red Bull": "#3671c6",
  McLaren: "#f58020",
  "Aston Martin": "#229971",
  Alpine: "#0093cc",
  Williams: "#64c4ff",
  "Racing Bulls": "#6692ff",
  Haas: "#b6babd",
  Audi: "#f04646",
  Cadillac: "#7c7c7c",
  "My Team": "#b81d89",
};

export type DriverTileProfile = Pick<
  DriverProfile,
  "name" | "team" | "stats" | "titles" | "seasonsActive"
>;

type DriverSortKey =
  "points" | "team" | "name" | "wins" | "podiums" | "poles" | "titles" | "seasons";

export function DriverProfileTiles({
  drivers,
  onSelect,
}: {
  drivers: DriverTileProfile[];
  onSelect: (driver: DriverTileProfile) => void;
}) {
  const [sortBy, setSortBy] = useState<DriverSortKey>("points");
  const sortedDrivers = useMemo(
    () =>
      [...drivers].sort((a, b) => {
        if (sortBy === "team" || sortBy === "name") {
          const aValue = sortBy === "team" ? canonicalTeam(a.team) : a.name;
          const bValue = sortBy === "team" ? canonicalTeam(b.team) : b.name;
          return aValue.localeCompare(bValue) || a.name.localeCompare(b.name);
        }

        const values: Record<Exclude<DriverSortKey, "team" | "name">, [number, number]> = {
          points: [a.stats.totalPoints, b.stats.totalPoints],
          wins: [a.stats.wins, b.stats.wins],
          podiums: [a.stats.podiums, b.stats.podiums],
          poles: [a.stats.poles, b.stats.poles],
          titles: [a.titles ?? 0, b.titles ?? 0],
          seasons: [a.seasonsActive ?? 0, b.seasonsActive ?? 0],
        };
        const [aValue, bValue] = values[sortBy];
        return bValue - aValue || a.name.localeCompare(b.name);
      }),
    [drivers, sortBy],
  );
  const showTitles = drivers.some((driver) => driver.titles !== undefined);
  const showSeasons = drivers.some((driver) => driver.seasonsActive !== undefined);

  return (
    <div>
      <div className="mb-2 flex justify-end px-2">
        <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Sort
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as DriverSortKey)}
            aria-label="Sort driver profiles"
            className="rounded-md border border-border bg-background px-2 py-1 text-xs font-semibold normal-case tracking-normal text-foreground"
          >
            <option value="points">Points</option>
            <option value="team">Team</option>
            <option value="name">Name</option>
            <option value="wins">Wins</option>
            <option value="podiums">Podiums</option>
            <option value="poles">Poles</option>
            {showTitles && <option value="titles">Titles</option>}
            {showSeasons && <option value="seasons">Seasons active</option>}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
        {sortedDrivers.map((driver) => (
          <button
            key={driver.name}
            type="button"
            onClick={() => onSelect(driver)}
            aria-label={`Open ${driver.name} profile`}
            className="relative aspect-square min-w-0 overflow-hidden rounded-xl border border-white/20 text-left text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            style={{ backgroundColor: TEAM_COLORS[canonicalTeam(driver.team)] ?? "#9aa0a6" }}
          >
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent"
            />
            <span className="absolute inset-x-0 bottom-0 truncate px-2 pb-2 pt-8 text-xs font-bold">
              {driver.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
