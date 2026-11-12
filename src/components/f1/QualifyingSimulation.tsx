import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Pencil, Check, Undo2, X, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { getActiveCareer } from "@/lib/career";
import { trackMapUrl, trackMapFallbackUrl, trackSlug } from "@/lib/f1-shell";
import { replayPair, lapProgress, liveGap, pointOnLine, type Point, type QualiResult } from "@/lib/quali-simulation";
import { RacingLineActions } from "./RacingLineActions";
import { resolveRacingLine, sharedRacingLine } from "@/lib/racing-lines";
import { loadTrackData, saveTrackData } from "@/lib/track-cloud";

type QualiSession = { id: string; driver_name: string; track_name: string; category: string; session_type: string; results: QualiResult[] };
const format = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(3).padStart(6, "0")}`;

export function QualifyingSimulation({ season, track, cat }: { season: number; track: string; cat?: string }) {
  const [sessions, setSessions] = useState<QualiSession[]>([]);
  const [selected, setSelected] = useState("");
  const [status, setStatus] = useState("Loading qualifying sessions…");
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [line, setLine] = useState<Point[]>([]);
  const [draft, setDraft] = useState<Point[]>([]);
  const [editing, setEditing] = useState(false);
  const [image, setImage] = useState(trackMapUrl(track));
  const [imageFailed, setImageFailed] = useState(false);
  const [lineMessage, setLineMessage] = useState("");
  const clock = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    setStatus("Loading qualifying sessions…");
    setSessions([]);
    (async () => {
      try {
        let query = supabase.from("telemetry_sessions").select("id,driver_name,track_name,category,session_type,results").eq("season", season);
        const career = getActiveCareer();
        if (career) query = query.eq("career_slot", career);
        const { data, error } = await query;
        if (error) throw error;
        if (!active) return;
        const rows = (data ?? []).filter((s) => trackSlug(s.track_name) === trackSlug(track) && /quali|shootout/i.test(`${s.category} ${s.session_type}`) &&
          (cat === "Sprint" ? /sprint|shootout/i.test(`${s.category} ${s.session_type}`) : !/sprint|shootout/i.test(`${s.category} ${s.session_type}`)))
          .sort((a,b) => String(a.session_type).localeCompare(String(b.session_type), undefined, { numeric: true })) as QualiSession[];
        setSessions(rows);
        setSelected(rows.at(-1)?.id ?? "");
        setStatus(rows.length ? "" : "No qualifying sessions uploaded for this weekend yet.");
      } catch {
        if (active) setStatus("Qualifying could not load. Check your connection and reload this page.");
      }
    })();
    return () => { active = false; };
  }, [season, track, cat]);

  useEffect(() => {
    setImage(trackMapUrl(track));
    setImageFailed(false);
    setEditing(false);
    setLine(sharedRacingLine(track));
    setLineMessage("");
    let live = true;
    loadTrackData("racing_line", trackSlug(track)).then((saved) => { if (live && saved) setLine(resolveRacingLine(track, saved)); }).catch(() => {});
    return () => { live = false; };
  }, [track]);

  const session = sessions.find((s) => s.id === selected);
  const pair = useMemo(() => session ? replayPair(Array.isArray(session.results) ? session.results : [], session.driver_name) : null, [session]);
  const duration = pair ? Math.max(pair.player.lap, pair.rival.lap) : 0;
  useEffect(() => { setPlaying(false); setElapsed(0); }, [selected]);
  useEffect(() => {
    if (!playing || !pair) return;
    let frame = 0;
    clock.current = null;
    const tick = (now: number) => {
      const dt = clock.current === null ? 0 : Math.min((now - clock.current) / 1000, 0.1);
      clock.current = now;
      setElapsed((previous) => Math.min(duration, previous + dt * speed));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, pair, duration, speed]);
  useEffect(() => { if (duration > 0 && elapsed >= duration) setPlaying(false); }, [elapsed, duration]);
  useEffect(() => {
    const pause = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener("visibilitychange", pause);
    return () => document.removeEventListener("visibilitychange", pause);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || editing || !pair || line.length < 3) return;
      const t = e.target as HTMLElement;
      if (/INPUT|SELECT|TEXTAREA|BUTTON/.test(t.tagName)) return;
      e.preventDefault();
      if (elapsed >= duration) setElapsed(0);
      setPlaying((p) => !p);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, pair, line.length, elapsed, duration]);

  async function saveLine() {
    if (draft.length < 3) return;
    setLine(draft);
    setEditing(false);
    try {
      const ok = await saveTrackData("racing_line", trackSlug(track), draft);
      setLineMessage(ok ? "Saved to your account — it now shows on all your devices." : "Line updated here. Sign in to keep it on all your devices.");
    } catch {
      setLineMessage("Line updated here, but saving to your account failed. Try again later.");
    }
  }
  const visibleLine = editing ? draft : line;
  const dots = pair ? [
    { ...pair.player, role: "You", className: "text-replay-player" },
    { ...pair.rival, role: `P${pair.rival.position}`, className: "text-replay-rival" },
  ] : [];

  return <section className="w-full">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Qualifying sessions">
        {sessions.map((s) => <Button key={s.id} variant={selected === s.id ? "default" : "outline"} onClick={() => setSelected(s.id)} aria-pressed={selected === s.id}>{s.session_type || s.category}</Button>)}
      </div>
      <span className="text-xs text-muted-foreground">{pair?.player.sectors && pair?.rival.sectors ? "Sector-paced estimate · Space to play" : "Estimated pace · lap-time based · Space to play"}</span>
    </div>
    {status && <p className="mb-4 text-sm text-muted-foreground" role="status">{status}</p>}
    {!status && !pair && <p className="mb-4 text-sm text-muted-foreground">A valid player lap and {session?.results?.some((r) => r.name === session.driver_name && Number(r.position) === 1) ? "P2" : "P1"} lap are needed for this session.</p>}
    <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:items-start">
    <div className="relative aspect-[1080/608] w-full min-w-0 overflow-hidden rounded-md border border-border bg-background">
      {!imageFailed && <img src={image} alt={`${track} circuit`} className="absolute inset-0 h-full w-full object-fill" onError={() => {
        if (image !== trackMapFallbackUrl(track)) setImage(trackMapFallbackUrl(track)); else setImageFailed(true);
      }} />}
      {imageFailed ? <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Track map unavailable</div> : <svg viewBox="0 0 1080 608" className={`absolute inset-0 h-full w-full ${editing ? "cursor-crosshair touch-manipulation" : "pointer-events-none"}`} role="img" aria-label="Qualifying lap simulation" onClick={(e) => {
        if (!editing) return;
        const box = e.currentTarget.getBoundingClientRect();
        setDraft((prev) => [...prev, { x: (e.clientX - box.left) / box.width, y: (e.clientY - box.top) / box.height }]);
      }}>
        {editing && visibleLine.length > 0 && <><polyline points={visibleLine.map((p) => `${p.x * 1080},${p.y * 608}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="3" className="text-replay-rival" />
          {visibleLine.map((p,i) => <circle key={i} cx={p.x*1080} cy={p.y*608} r={i === 0 ? 8 : 4} fill="currentColor" className={i === 0 ? "text-replay-player" : "text-replay-rival"}/>)}</>}
        {!editing && line.length >= 3 && <polyline points={[...line, line[0]].map((p) => `${p.x * 1080},${p.y * 608}`).join(" ")} fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="2" strokeDasharray="6 6" className="text-foreground" />}
        {!editing && line.length >= 3 && dots.map((d) => {
          const p = pointOnLine(line, lapProgress(elapsed,d.lap,d.sectors));
          return <g key={d.role} className={d.className} transform={`translate(${p.x*1080} ${p.y*608})`}>
            <circle r="11" fill="currentColor" stroke="var(--background)" strokeWidth="3" />
            <text y={d.role === "You" ? -19 : 29} textAnchor="middle" fill="currentColor" fontSize="18" fontWeight="700">{d.role}</text>
          </g>;
        })}
      </svg>}
    </div>

    <aside className="flex min-w-0 flex-col gap-3 rounded-md border border-border bg-card/40 p-3" aria-label="Simulation controls">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button size="icon" aria-label={playing ? "Pause simulation" : "Play simulation"} title={playing ? "Pause" : "Play"} disabled={!pair || line.length < 3 || editing || imageFailed} onClick={() => { if (elapsed >= duration) setElapsed(0); setPlaying((p) => !p); }}>{playing ? <Pause/> : <Play/>}</Button>
          <Button variant="outline" size="icon" title="Restart" aria-label="Restart simulation" disabled={!pair} onClick={() => {setPlaying(false);setElapsed(0);}}><RotateCcw/></Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm tabular-nums">{format(elapsed)}</span>
          {pair && elapsed > 0 && (() => { const g = liveGap(elapsed, pair.player, pair.rival); return <span className={`rounded px-2 py-0.5 font-mono text-xs font-bold tabular-nums ${g > 0 ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`} title="Live gap to the other driver">{g > 0 ? "+" : "−"}{Math.abs(g).toFixed(3)}</span>; })()}
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">Lap position</span>
        <input type="range" aria-label="Lap playback position" min="0" max={duration || 1} step="0.01" value={elapsed} disabled={!pair || editing} onChange={(e) => {setPlaying(false);setElapsed(Number(e.target.value));}} className="w-full accent-primary"/>
      </label>

      <div role="group" aria-label="Playback speed">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Speed</span>
          <span className="font-mono text-xs tabular-nums" aria-live="polite">{speed}×</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Slow down playback" title="Slower" disabled={speed <= 0.25} onClick={() => setSpeed((s) => Math.max(0.25, Math.round((s - 0.25) * 100) / 100))}><Minus/></Button>
          <input type="range" aria-label="Playback speed" min="0.25" max="8" step="0.25" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="h-1.5 min-w-0 flex-1 accent-primary" />
          <Button variant="ghost" size="icon" aria-label="Speed up playback" title="Faster" disabled={speed >= 8} onClick={() => setSpeed((s) => Math.min(8, Math.round((s + 0.25) * 100) / 100))}><Plus/></Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-y border-border py-3">
        {dots.map((d) => <div key={d.role} className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2"><span className={`h-2.5 w-2.5 shrink-0 rounded-full bg-current ${d.className}`}/><div className="min-w-0"><div className="truncate text-sm font-bold">{d.name}</div><div className="text-xs text-muted-foreground">{d.role} · P{d.position}{elapsed >= d.lap ? " · Finished" : ""}</div></div></div>
          <div className="shrink-0 text-right"><div className="font-mono text-sm tabular-nums">{format(d.lap)}</div>{d.sectors && <div className="font-mono text-[11px] text-muted-foreground tabular-nums">{d.sectors.map((x) => x.toFixed(3)).join(" · ")}</div>}</div>
        </div>)}
        {pair && <div className="flex flex-wrap justify-between gap-2 text-sm"><span className="text-muted-foreground">Lap-time difference</span><span className="font-mono">{pair.player.lap >= pair.rival.lap ? "+" : "−"}{Math.abs(pair.player.lap-pair.rival.lap).toFixed(3)}s</span></div>}
      </div>

      {!editing ? <Button variant="outline" className="w-full" disabled={imageFailed} onClick={() => {setDraft([]);setEditing(true);setPlaying(false);}}><Pencil/>Set racing line</Button> : <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Undo point" title="Undo point" disabled={!draft.length} onClick={() => setDraft((p) => p.slice(0,-1))}><Undo2/></Button>
        <Button variant="outline" className="flex-1" disabled={draft.length < 3} onClick={saveLine}><Check/>Export edited line</Button>
        <Button variant="ghost" size="icon" aria-label="Cancel line editing" title="Cancel" onClick={() => setEditing(false)}><X/></Button>
      </div>}
      {editing && <p className="text-sm text-muted-foreground">Start at the finish line, then tap around the circuit in driving order. {draft.length} points.</p>}
      {!editing && line.length < 3 && !imageFailed && <p className="text-sm text-muted-foreground">This track needs a racing line before playback is available.</p>}
      <RacingLineActions
        track={track}
        mapUrl={image}
        line={editing ? draft : line}
        onDraft={(points) => { setLine(points); setDraft([]); setEditing(false); setPlaying(false); setLineMessage(""); }}
      />
      {lineMessage && <p role="status" className="text-xs text-muted-foreground">{lineMessage}</p>}
    </aside>
    </div>
  </section>;
}