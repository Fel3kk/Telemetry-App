import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { canonicalTeam } from "@/lib/driver-identity";
import type { ConstructorCareerProfile } from "@/lib/f1-stats";
import { TEAM_COLORS } from "@/lib/team-colors";
import { ProfileCompareDialog, type ProfileCompareRow } from "@/components/f1/ProfileCompareDialog";
import { ProfileTileButton } from "@/components/f1/ProfileTileButton";
import { comparisonWinner } from "@/lib/profile-comparison";
import { teamLogo } from "@/lib/profile-images";

type SortKey = "points" | "team" | "wins" | "podiums" | "poles" | "titles" | "seasons";

export function ConstructorProfileTiles({
  constructors,
}: {
  constructors: ConstructorCareerProfile[];
}) {
  const [sortBy, setSortBy] = useState<SortKey>("points");
  const [selected, setSelected] = useState<ConstructorCareerProfile | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [comparison, setComparison] = useState<
    [ConstructorCareerProfile, ConstructorCareerProfile] | null
  >(null);
  const sortedConstructors = useMemo(
    () =>
      [...constructors].sort((a, b) => {
        if (sortBy === "team") return a.team.localeCompare(b.team);
        const values: Record<Exclude<SortKey, "team">, [number, number]> = {
          points: [a.points, b.points],
          wins: [a.wins, b.wins],
          podiums: [a.podiums, b.podiums],
          poles: [a.poles, b.poles],
          titles: [a.titles, b.titles],
          seasons: [a.seasonsActive, b.seasonsActive],
        };
        const [aValue, bValue] = values[sortBy];
        return bValue - aValue || a.team.localeCompare(b.team);
      }),
    [constructors, sortBy],
  );
  const toggleTeamSelection = (team: string) => {
    setSelectedTeams((teams) => {
      if (teams.includes(team)) return teams.filter((selectedTeam) => selectedTeam !== team);
      return teams.length < 2 ? [...teams, team] : teams;
    });
  };
  const compareSelected = () => {
    const profiles = selectedTeams
      .map((team) => constructors.find((constructor) => constructor.team === team))
      .filter((constructor): constructor is ConstructorCareerProfile => constructor !== undefined);
    if (profiles.length === 2) setComparison([profiles[0], profiles[1]]);
  };

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setCompareMode((active) => !active);
              setSelectedTeams([]);
            }}
            disabled={constructors.length < 2}
            aria-pressed={compareMode}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs font-semibold text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {compareMode ? "Cancel compare" : "Compare teams"}
          </button>
          {compareMode && (
            <>
              <span className="text-xs text-muted-foreground">
                Select 2 ({selectedTeams.length}/2)
              </span>
              <button
                type="button"
                onClick={compareSelected}
                disabled={selectedTeams.length !== 2}
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
            onChange={(event) => setSortBy(event.target.value as SortKey)}
            aria-label="Sort constructor profiles"
            className="rounded-md border border-border bg-background px-2 py-1 text-xs font-semibold normal-case tracking-normal text-foreground"
          >
            <option value="points">Points</option>
            <option value="team">Team</option>
            <option value="wins">Wins</option>
            <option value="podiums">Podiums</option>
            <option value="poles">Poles</option>
            <option value="titles">Titles</option>
            <option value="seasons">Seasons active</option>
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
        {sortedConstructors.map((constructor) => {
          const isSelected = selectedTeams.includes(constructor.team);
          const selectionLimitReached = compareMode && selectedTeams.length === 2 && !isSelected;
          return (
            <ProfileTileButton
              key={constructor.team}
              name={constructor.team}
              profileType="team"
              imageSrc={teamLogo(constructor.team)}
              backgroundColor={TEAM_COLORS[canonicalTeam(constructor.team)] ?? "#9aa0a6"}
              selected={compareMode ? isSelected : undefined}
              disabled={selectionLimitReached}
              ariaLabel={
                compareMode
                  ? `${isSelected ? "Remove" : "Select"} ${constructor.team} for comparison`
                  : `Open ${constructor.team} constructor profile`
              }
              onClick={() =>
                compareMode ? toggleTeamSelection(constructor.team) : setSelected(constructor)
              }
            />
          );
        })}
      </div>
      {comparison && (
        <ProfileCompareDialog
          open={comparison !== null}
          onClose={() => setComparison(null)}
          profileType="Constructor"
          context="All-Time Stats"
          leftName={comparison[0].team}
          rightName={comparison[1].team}
          rows={constructorCompareRows(comparison[0], comparison[1])}
        />
      )}
      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        {selected && (
          <DialogContent className="max-w-lg border-border bg-background">
            <DialogHeader>
              <DialogTitle className="text-xl font-black">{selected.team}</DialogTitle>
              <DialogDescription>
                All-time constructor stats · {selected.seasonsActive} season
                {selected.seasonsActive === 1 ? "" : "s"}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Metric label="Points" value={selected.points} />
              <Metric label="Wins" value={selected.wins} />
              <Metric label="Podiums" value={selected.podiums} />
              <Metric label="Poles" value={selected.poles} />
              <Metric label="Titles" value={selected.titles} />
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

function constructorCompareRows(
  left: ConstructorCareerProfile,
  right: ConstructorCareerProfile,
): ProfileCompareRow[] {
  const row = (label: string, leftValue: number, rightValue: number): ProfileCompareRow => ({
    label,
    leftValue,
    rightValue,
    winner: comparisonWinner(leftValue, rightValue, "higher"),
  });
  return [
    row("Points", left.points, right.points),
    row("Wins", left.wins, right.wins),
    row("Podiums", left.podiums, right.podiums),
    row("Poles", left.poles, right.poles),
    row("Titles", left.titles, right.titles),
    row("Seasons active", left.seasonsActive, right.seasonsActive),
  ];
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-lg border border-border/70 bg-card/50 px-3 py-2.5">
      <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-black tabular-nums">{value}</p>
    </article>
  );
}
