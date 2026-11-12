import type { DriverProfile } from "@/components/f1/DriverProfileDialog";

export type DriverTileProfile = Pick<
  DriverProfile,
  "name" | "team" | "stats" | "titles" | "seasonsActive"
>;

export function DriverProfileTiles({
  drivers,
  onSelect,
}: {
  drivers: DriverTileProfile[];
  onSelect: (driver: DriverTileProfile) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {drivers.map((driver) => (
        <button
          key={driver.name}
          type="button"
          onClick={() => onSelect(driver)}
          aria-label={`Open ${driver.name} profile`}
          className="flex min-w-0 flex-col items-center gap-2 rounded-xl border border-border/70 bg-card/60 px-3 py-4 text-center transition hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span
            role="img"
            aria-label="Blank profile picture placeholder"
            className="h-16 w-16 rounded-full border border-border bg-background/70"
          />
          <span className="w-full truncate text-sm font-bold">{driver.name}</span>
          {driver.team && (
            <span className="w-full truncate text-[10px] text-muted-foreground">{driver.team}</span>
          )}
        </button>
      ))}
    </div>
  );
}
