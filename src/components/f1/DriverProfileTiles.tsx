import { useMemo, useState } from "react";
import type { DriverProfile } from "@/components/f1/DriverProfileDialog";
import { ProfileCompareDialog, type ProfileCompareRow } from "@/components/f1/ProfileCompareDialog";
import { canonicalTeam, normalizeDriver } from "@/lib/driver-identity";
import type { DriverTeamHistory } from "@/lib/f1-stats";
import { comparisonWinner, type ComparisonDirection } from "@/lib/profile-comparison";
import { driverProfileImage } from "@/lib/profile-images";
import { TEAM_COLORS } from "@/lib/team-colors";
import { ProfileTileButton } from "@/components/f1/ProfileTileButton";

export type DriverTileProfile = Pick<
  DriverProfile,
  "name" | "team" | "stats" | "titles" | "seasonsActive"
> & {
  imageSrc?: string;
};

type DriverSortKey =
  "points" | "team" | "name" | "wins" | "podiums" | "poles" | "titles" | "seasons";

export function DriverProfileTiles({
  drivers,
  teamHistories,
  onSelect,
}: {
  drivers: DriverTileProfile[];
  teamHistories: DriverTeamHistory[];
  onSelect: (driver: DriverTileProfile) => void;
}) {
  const [sortBy, setSortBy] = useState<DriverSortKey>("points");
  const [compareMode, setCompareMode] = useState(false);
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [comparison, setComparison] = useState<[DriverTileProfile, DriverTileProfile] | null>(null);
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
  const teamHistoryByDriver = useMemo(
    () => new Map(teamHistories.map((history) => [history.name, history.seasons])),
    [teamHistories],
  );
  const toggleCompareMode = () => {
    setCompareMode((active) => !active);
    setSelectedNames([]);
  };
  const toggleDriverSelection = (name: string) => {
    setSelectedNames((selected) => {
      if (selected.includes(name)) return selected.filter((selectedName) => selectedName !== name);
      return selected.length < 2 ? [...selected, name] : selected;
    });
  };
  const compareSelected = () => {
    const selected = selectedNames
      .map((name) => drivers.find((driver) => driver.name === name))
      .filter((driver): driver is DriverTileProfile => driver !== undefined);
    if (selected.length === 2) setComparison([selected[0], selected[1]]);
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleCompareMode}
            disabled={drivers.length < 2}
            aria-pressed={compareMode}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs font-semibold text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {compareMode ? "Cancel compare" : "Compare drivers"}
          </button>
          {compareMode && (
            <>
              <span className="text-xs text-muted-foreground">
                Select 2 ({selectedNames.length}/2)
              </span>
              <button
                type="button"
                onClick={compareSelected}
                disabled={selectedNames.length !== 2}
                className="rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                Compare
              </button>
            </>
          )}
        </div>
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
        {sortedDrivers.map((driver) => {
          const isSelected = selectedNames.includes(driver.name);
          const selectionLimitReached = compareMode && selectedNames.length === 2 && !isSelected;
          const imageSrc = driverProfileImage(
            driver.name,
            driver.stats.season,
            teamHistoryByDriver.get(normalizeDriver(driver.name)),
          );
          return (
            <ProfileTileButton
              key={driver.name}
              name={driver.name}
              profileType="driver"
              imageSrc={imageSrc}
              backgroundColor={TEAM_COLORS[canonicalTeam(driver.team)] ?? "#9aa0a6"}
              selected={compareMode ? isSelected : undefined}
              disabled={selectionLimitReached}
              ariaLabel={
                compareMode
                  ? `${isSelected ? "Remove" : "Select"} ${driver.name} for comparison`
                  : `Open ${driver.name} profile`
              }
              onClick={() =>
                compareMode ? toggleDriverSelection(driver.name) : onSelect({ ...driver, imageSrc })
              }
            />
          );
        })}
      </div>
      {comparison && (
        <ProfileCompareDialog
          open={comparison !== null}
          onClose={() => setComparison(null)}
          profileType="Driver"
          context={comparison[0].seasonsActive ? "All-Time Stats" : "Season Stats"}
          leftName={comparison[0].name}
          rightName={comparison[1].name}
          rows={driverCompareRows(comparison[0], comparison[1])}
        />
      )}
    </div>
  );
}

function driverCompareRows(left: DriverTileProfile, right: DriverTileProfile): ProfileCompareRow[] {
  const format = (value: number | null, digits = 1) =>
    value == null ? "—" : value.toFixed(digits);
  const position = (value: number | null) => (value == null ? "—" : `P${value}`);
  const qualiStageCount = (value: number, total: number) => (total ? `${value} / ${total}` : "—");
  const finishRate = (value: number | null) => (value == null ? "—" : `${format(value)}%`);
  const row = (
    label: string,
    leftValue: string | number,
    rightValue: string | number,
    leftScore: number | null,
    rightScore: number | null,
    direction: ComparisonDirection = "higher",
  ): ProfileCompareRow => ({
    label,
    leftValue,
    rightValue,
    winner: comparisonWinner(leftScore, rightScore, direction),
  });
  const leftStarts = left.stats.gpStarts + left.stats.sprintStarts;
  const rightStarts = right.stats.gpStarts + right.stats.sprintStarts;
  const leftQ1Exits = left.stats.q1Apps - left.stats.q2Apps;
  const rightQ1Exits = right.stats.q1Apps - right.stats.q2Apps;
  const rows = [
    row(
      "Championship",
      position(left.stats.championshipPos),
      position(right.stats.championshipPos),
      left.stats.championshipPos,
      right.stats.championshipPos,
      "lower",
    ),
    row(
      "Points",
      left.stats.totalPoints,
      right.stats.totalPoints,
      left.stats.totalPoints,
      right.stats.totalPoints,
    ),
    row(
      "Average points / start",
      format(left.stats.avgPoints),
      format(right.stats.avgPoints),
      left.stats.avgPoints,
      right.stats.avgPoints,
    ),
    row(
      "Wins",
      `${left.stats.wins} GP · ${left.stats.sprintWins} sprint`,
      `${right.stats.wins} GP · ${right.stats.sprintWins} sprint`,
      left.stats.wins + left.stats.sprintWins,
      right.stats.wins + right.stats.sprintWins,
    ),
    row(
      "Podiums",
      left.stats.podiums,
      right.stats.podiums,
      left.stats.podiums,
      right.stats.podiums,
    ),
    row(
      "Poles",
      `${left.stats.poles} GP · ${left.stats.sprintPoles} sprint`,
      `${right.stats.poles} GP · ${right.stats.sprintPoles} sprint`,
      left.stats.poles + left.stats.sprintPoles,
      right.stats.poles + right.stats.sprintPoles,
    ),
    row(
      "Fastest laps",
      left.stats.fastestLaps,
      right.stats.fastestLaps,
      left.stats.fastestLaps,
      right.stats.fastestLaps,
    ),
    row(
      "Points finishes",
      left.stats.pointsFinishes,
      right.stats.pointsFinishes,
      left.stats.pointsFinishes,
      right.stats.pointsFinishes,
    ),
    row(
      "Best finish",
      position(left.stats.bestFinish),
      position(right.stats.bestFinish),
      left.stats.bestFinish,
      right.stats.bestFinish,
      "lower",
    ),
    row(
      "Average finish",
      format(left.stats.avgFinish),
      format(right.stats.avgFinish),
      left.stats.avgFinish,
      right.stats.avgFinish,
      "lower",
    ),
    row(
      "Average grid",
      format(left.stats.avgGrid),
      format(right.stats.avgGrid),
      left.stats.avgGrid,
      right.stats.avgGrid,
      "lower",
    ),
    row(
      "Net positions gained",
      left.stats.positionsGained,
      right.stats.positionsGained,
      left.stats.positionsGained,
      right.stats.positionsGained,
    ),
    row("DNFs", left.stats.dnfs, right.stats.dnfs, left.stats.dnfs, right.stats.dnfs, "lower"),
    row(
      "Finish rate",
      finishRate(left.stats.finishRate),
      finishRate(right.stats.finishRate),
      left.stats.finishRate,
      right.stats.finishRate,
    ),
    row(
      "Q3 appearances",
      qualiStageCount(left.stats.q3Apps, left.stats.q1Apps),
      qualiStageCount(right.stats.q3Apps, right.stats.q1Apps),
      left.stats.q1Apps ? left.stats.q3Apps / left.stats.q1Apps : null,
      right.stats.q1Apps ? right.stats.q3Apps / right.stats.q1Apps : null,
    ),
    row(
      "Q2 appearances",
      qualiStageCount(left.stats.q2Apps, left.stats.q1Apps),
      qualiStageCount(right.stats.q2Apps, right.stats.q1Apps),
      left.stats.q1Apps ? left.stats.q2Apps / left.stats.q1Apps : null,
      right.stats.q1Apps ? right.stats.q2Apps / right.stats.q1Apps : null,
    ),
    row(
      "Q1 exits",
      left.stats.q1Apps ? Math.max(0, leftQ1Exits) : "—",
      right.stats.q1Apps ? Math.max(0, rightQ1Exits) : "—",
      left.stats.q1Apps ? leftQ1Exits / left.stats.q1Apps : null,
      right.stats.q1Apps ? rightQ1Exits / right.stats.q1Apps : null,
      "lower",
    ),
    row(
      "Average qualifying",
      format(left.stats.avgQuali),
      format(right.stats.avgQuali),
      left.stats.avgQuali,
      right.stats.avgQuali,
      "lower",
    ),
    row(
      "Starts",
      `${left.stats.gpStarts} GP · ${left.stats.sprintStarts} sprint`,
      `${right.stats.gpStarts} GP · ${right.stats.sprintStarts} sprint`,
      leftStarts,
      rightStarts,
    ),
    row(
      "Laps completed",
      left.stats.lapsCompleted,
      right.stats.lapsCompleted,
      left.stats.lapsCompleted,
      right.stats.lapsCompleted,
    ),
  ];
  if (left.titles !== undefined || right.titles !== undefined) {
    rows.push(
      row("Titles", left.titles ?? 0, right.titles ?? 0, left.titles ?? 0, right.titles ?? 0),
    );
  }
  if (left.seasonsActive !== undefined || right.seasonsActive !== undefined) {
    rows.push(
      row(
        "Seasons active",
        left.seasonsActive ?? 0,
        right.seasonsActive ?? 0,
        left.seasonsActive ?? 0,
        right.seasonsActive ?? 0,
      ),
    );
  }
  return rows;
}
