import { useState } from "react";
import type { DriverTeamHistory as DriverTeamHistoryData } from "@/lib/f1-stats";

export function DriverTeamHistory({ histories }: { histories: DriverTeamHistoryData[] }) {
  const [selectedDriver, setSelectedDriver] = useState("");
  const selectedHistory = histories.find((history) => history.name === selectedDriver);

  if (histories.length === 0) {
    return <p className="px-3 py-2 text-sm text-white/45">No driver team history recorded yet.</p>;
  }

  return (
    <div className="space-y-3 px-3">
      <div>
        <p className="mb-2 text-xs font-semibold text-white/70">Choose a driver</p>
        <div
          role="group"
          aria-label="Choose a driver for team history"
          className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
        >
          {histories.map((history) => {
            const isSelected = selectedDriver === history.name;
            return (
              <button
                key={history.name}
                type="button"
                aria-pressed={isSelected}
                onClick={() =>
                  setSelectedDriver((current) => (current === history.name ? "" : history.name))
                }
                className={`min-w-0 truncate rounded-md border px-2.5 py-2 text-left text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isSelected
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border/70 bg-background/30 text-white/70 hover:border-primary/60 hover:text-white"
                }`}
              >
                {history.name}
              </button>
            );
          })}
        </div>
      </div>

      {selectedHistory ? (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-white/80">{selectedHistory.name} · Team History</h3>
          <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {selectedHistory.seasons.map(({ season, team }) => (
              <li
                key={season}
                className="flex items-center gap-3 rounded-lg border border-border/70 bg-background/30 px-3 py-2"
              >
                <span className="rounded bg-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/50">
                  S{season}
                </span>
                <span className="min-w-0 truncate text-sm font-semibold text-white/80">{team}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <p className="text-sm text-white/45">
          Select a driver above to see one team for each season.
        </p>
      )}
    </div>
  );
}
