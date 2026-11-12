import type { LiveTelemetry } from "@/lib/quali-physics";

export function QualifyingHud({ telemetry }: { telemetry: LiveTelemetry | null }) {
  return <div className="border-y border-border py-3" aria-label="Estimated live telemetry">
    <div className="flex items-end justify-between gap-4">
      <div><div className="text-[11px] text-muted-foreground">Estimated speed</div><output aria-label="Estimated speed" className="font-mono text-4xl font-bold tabular-nums">{telemetry ? Math.round(telemetry.speed) : "—"}</output><span className="ml-2 text-xs text-muted-foreground">km/h</span></div>
      <div className="text-right"><div className="text-[11px] text-muted-foreground">Gear</div><output aria-label="Estimated gear" className="font-mono text-4xl font-bold tabular-nums">{telemetry?.gear ?? "—"}</output></div>
    </div>
    <div className="mt-3 grid grid-cols-2 gap-3">
      <label className="text-xs text-muted-foreground">Throttle <span className="float-right font-mono tabular-nums">{Math.round(telemetry?.throttle ?? 0)}%</span><progress aria-label="Estimated throttle" className="quali-pedal quali-throttle mt-1 h-2 w-full" max="100" value={telemetry?.throttle ?? 0}/></label>
      <label className="text-xs text-muted-foreground">Brake <span className="float-right font-mono tabular-nums">{Math.round(telemetry?.brake ?? 0)}%</span><progress aria-label="Estimated brake" className="quali-pedal quali-brake mt-1 h-2 w-full" max="100" value={telemetry?.brake ?? 0}/></label>
    </div>
  </div>;
}