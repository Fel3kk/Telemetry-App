import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SeasonSummary } from "@/lib/f1-stats";

export type DriverProfile = {
  name: string;
  team: string;
  stats: SeasonSummary;
  titles?: number;
  seasonsActive?: number;
};

function numberValue(value: number | null, digits = 1): string {
  return value == null ? "—" : value.toFixed(digits);
}

function positionValue(value: number | null): string {
  return value == null ? "—" : `P${value}`;
}

export function DriverProfileDialog({
  driver,
  context,
  onClose,
}: {
  driver: DriverProfile | null;
  context: string;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={driver !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {driver && (
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-border bg-background">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">{driver.name}</DialogTitle>
            <DialogDescription>
              {[
                driver.team,
                context,
                driver.seasonsActive ? `${driver.seasonsActive} seasons` : "",
                driver.titles ? `${driver.titles} title${driver.titles === 1 ? "" : "s"}` : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <article className="rounded-xl border border-primary/30 bg-primary/10 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Championship
              </p>
              <p className="mt-1 text-2xl font-black">
                {positionValue(driver.stats.championshipPos)}
              </p>
            </article>
            <article className="rounded-xl border border-border bg-card/60 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Total points
              </p>
              <p className="mt-1 text-2xl font-black tabular-nums">{driver.stats.totalPoints}</p>
              <p className="text-xs text-muted-foreground">
                {numberValue(driver.stats.avgPoints)} per start
              </p>
            </article>
            <article className="rounded-xl border border-border bg-card/60 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Average finish / grid
              </p>
              <p className="mt-1 text-2xl font-black tabular-nums">
                {numberValue(driver.stats.avgFinish)} / {numberValue(driver.stats.avgGrid)}
              </p>
            </article>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            <Metric
              label="Wins"
              value={`${driver.stats.wins} GP · ${driver.stats.sprintWins} sprint`}
            />
            <Metric label="Podiums" value={driver.stats.podiums} />
            <Metric
              label="Poles"
              value={`${driver.stats.poles} GP · ${driver.stats.sprintPoles} sprint`}
            />
            <Metric label="Fastest laps" value={driver.stats.fastestLaps} />
            <Metric label="Points finishes" value={driver.stats.pointsFinishes} />
            <Metric label="Best finish" value={positionValue(driver.stats.bestFinish)} />
            <Metric label="Net positions gained" value={driver.stats.positionsGained} />
            <Metric label="DNFs" value={driver.stats.dnfs} />
            <Metric
              label="Finish rate"
              value={
                driver.stats.finishRate == null ? "—" : `${numberValue(driver.stats.finishRate)}%`
              }
            />
            <Metric
              label="Q3 appearances"
              value={driver.stats.q1Apps ? `${driver.stats.q3Apps} / ${driver.stats.q1Apps}` : "—"}
            />
            <Metric
              label="Q2 appearances"
              value={driver.stats.q1Apps ? `${driver.stats.q2Apps} / ${driver.stats.q1Apps}` : "—"}
            />
            <Metric
              label="Q1 exits"
              value={
                driver.stats.q1Apps ? Math.max(0, driver.stats.q1Apps - driver.stats.q2Apps) : "—"
              }
            />
            <Metric label="Average qualifying" value={numberValue(driver.stats.avgQuali)} />
            <Metric
              label="Podium rate"
              value={
                driver.stats.starts
                  ? `${numberValue((driver.stats.podiums / driver.stats.starts) * 100)}%`
                  : "—"
              }
            />
            <Metric
              label="Starts"
              value={`${driver.stats.gpStarts} GP · ${driver.stats.sprintStarts} sprint`}
            />
            <Metric label="Laps completed" value={driver.stats.lapsCompleted} />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Qualifying metrics use the qualifying results available in uploaded sessions.
          </p>
        </DialogContent>
      )}
    </Dialog>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="min-w-0 rounded-lg border border-border/70 bg-card/50 px-3 py-2.5">
      <p className="truncate text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-black tabular-nums">{value}</p>
    </article>
  );
}
