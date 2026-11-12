import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Copy, Download, Minus, Pencil, Plus, Trash2, Upload, X, Check, Undo2, Cloud, CloudOff, ZoomIn, ZoomOut, MousePointer2, CloudUpload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trackMapUrl, trackMapFallbackUrl, trackSlug } from "@/lib/f1-shell";
import type { Point } from "@/lib/quali-simulation";
import { resolveRacingLine, sharedRacingLine } from "@/lib/racing-lines";
import { loadTrackData, saveTrackData } from "@/lib/track-cloud";
import { RacingLineActions } from "./RacingLineActions";
import {
  coverage, ersKeys, isValidSegment, isMapTap, lapOrder, nudge, pointAtProgress, projectOnLine, segmentSpan, sliceLine,
  type ErsColor, type ErsMode, type ErsSegment, type ErsSlotMeta,
} from "@/lib/ers-map";

// Suggested swatches only — the user names every colour themselves.
const SWATCHES = ["#22c55e", "#06b6d4", "#3b82f6", "#a855f7", "#ef4444", "#f59e0b", "#eab308", "#f8fafc"];
const STEP = 0.0025; // 0.25 % of the lap per nudge
const SNAP = 0.06; // max tap distance from the line (map widths)

const uid = () => Math.random().toString(36).slice(2, 10);
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function loadLine(track: string): Point[] {
  return sharedRacingLine(track);
}

function loadSlots(slug: string, mode: ErsMode): ErsSlotMeta[] {
  const slots = readJson<ErsSlotMeta[]>(ersKeys.slots(slug, mode), []);
  const valid = Array.isArray(slots) ? slots.filter((s) => s && typeof s.id === "string" && typeof s.name === "string") : [];
  return valid.length ? valid : [{ id: "slot1", name: "Slot 1" }];
}

type ErsBundle = { version: 1; palette: ErsColor[]; modes: Record<ErsMode, (ErsSlotMeta & { segments: ErsSegment[] })[]> };

function bundleFromDevice(slug: string): ErsBundle {
  const modes = {} as ErsBundle["modes"];
  for (const m of ["race", "quali"] as ErsMode[]) modes[m] = loadSlots(slug, m).map((s) => ({ ...s, segments: loadSegments(slug, m, s.id) }));
  return { version: 1, palette: readJson<ErsColor[]>(ersKeys.palette, []), modes };
}

function writeBundleToDevice(slug: string, data: any) {
  if (!data || typeof data !== "object" || typeof data.modes !== "object") return;
  const incoming: ErsColor[] = Array.isArray(data.palette) ? data.palette.filter((c: ErsColor) => c?.id && c?.name && /^#[0-9a-f]{6}$/i.test(c.color)) : [];
  const local = readJson<ErsColor[]>(ersKeys.palette, []);
  const merged = [...(Array.isArray(local) ? local : []), ...incoming.filter((c) => !local.some?.((p) => p.id === c.id))];
  localStorage.setItem(ersKeys.palette, JSON.stringify(merged));
  for (const m of ["race", "quali"] as ErsMode[]) {
    const list = Array.isArray(data.modes[m]) ? data.modes[m] : [];
    const metas: ErsSlotMeta[] = [];
    for (const s of list) {
      if (!s || typeof s.id !== "string" || typeof s.name !== "string") continue;
      metas.push({ id: s.id, name: s.name.slice(0, 40) });
      localStorage.setItem(ersKeys.map(slug, m, s.id), JSON.stringify((Array.isArray(s.segments) ? s.segments : []).filter(isValidSegment)));
    }
    if (metas.length) localStorage.setItem(ersKeys.slots(slug, m), JSON.stringify(metas));
  }
}

function loadSegments(slug: string, mode: ErsMode, slotId: string): ErsSegment[] {
  const segs = readJson<unknown[]>(ersKeys.map(slug, mode, slotId), []);
  return Array.isArray(segs) ? segs.filter(isValidSegment) : [];
}

export function ErsMapEditor({ season, track, cat }: { season: number; track: string; cat?: string }) {
  const slug = trackSlug(track);
  const [mode, setMode] = useState<ErsMode>("race");
  const [palette, setPalette] = useState<ErsColor[]>([]);
  const [slots, setSlots] = useState<ErsSlotMeta[]>([]);
  const [slotId, setSlotId] = useState("slot1");
  const [segments, setSegments] = useState<ErsSegment[]>([]);
  const [activeColor, setActiveColor] = useState("");
  const [pending, setPending] = useState<number | null>(null);
  const [selectedSeg, setSelectedSeg] = useState<string | null>(null);
  const [line, setLine] = useState<Point[]>([]);
  const [image, setImage] = useState(trackMapUrl(track));
  const [imageFailed, setImageFailed] = useState(false);
  const [hint, setHint] = useState("");
  const [ready, setReady] = useState(false);
  const [newColor, setNewColor] = useState({ name: "", color: SWATCHES[0] });
  const [editingColor, setEditingColor] = useState<string | null>(null);
  const [slotName, setSlotName] = useState<{ mode: "new" | "rename"; value: string } | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [history, setHistory] = useState<ErsSegment[][]>([]);
  const [sync, setSync] = useState<"local" | "loading" | "saved" | "saving" | "error">("loading");
  const pushTimer = useRef<number | undefined>(undefined);
  const [cloudTick, setCloudTick] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState<"paint" | "select">("paint");
  const pointerStart = useRef<Point | null>(null);
  const syncReady = useRef(false);

  // Load palette + racing line on mount / track change (browser only).
  useEffect(() => {
    const p = readJson<ErsColor[]>(ersKeys.palette, []);
    const valid = Array.isArray(p) ? p.filter((c) => c && c.id && c.name && /^#[0-9a-f]{6}$/i.test(c.color)) : [];
    setPalette(valid);
    setActiveColor((cur) => cur || valid[0]?.id || "");
    setLine(loadLine(track));
    setImage(trackMapUrl(track));
    setImageFailed(false);
    let live = true;
    syncReady.current = false;
    setZoom(1);
    setSync("loading");
    (async () => {
      try {
        const [savedLine, bundle] = await Promise.all([
          loadTrackData("racing_line", slug),
          loadTrackData("ers", slug),
        ]);
        if (!live) return;
        if (savedLine) setLine(resolveRacingLine(track, savedLine));
        if (bundle) {
          writeBundleToDevice(slug, bundle);
          const p2 = readJson<ErsColor[]>(ersKeys.palette, []);
          setPalette(p2);
          setActiveColor((cur) => cur || p2[0]?.id || "");
          setCloudTick((t) => t + 1);
        }
        const { supabase } = await import("@/lib/supabase");
        const { data } = await supabase.auth.getSession();
        if (live) { syncReady.current = true; setSync(data.session ? "saved" : "local"); }
      } catch {
        if (live) setSync("error");
      }
    })();
    return () => { live = false; syncReady.current = false; window.clearTimeout(pushTimer.current); };
  }, [track, slug]);

  // Load slots for this track + mode.
  useEffect(() => {
    const s = loadSlots(slug, mode);
    const saved = readJson<string>(ersKeys.activeSlot(slug, mode), "");
    const id = s.some((x) => x.id === saved) ? saved : s[0].id;
    setSlots(s);
    setSlotId(id);
    setSegments(loadSegments(slug, mode, id));
    setPending(null);
    setSelectedSeg(null);
    setReady(true);
    setHistory([]);
  }, [slug, mode, cloudTick]);

  function scheduleCloudPush() {
    if (!syncReady.current || sync === "local") return;
    window.clearTimeout(pushTimer.current);
    pushTimer.current = window.setTimeout(async () => {
      setSync("saving");
      try {
        const ok = await saveTrackData("ers", slug, bundleFromDevice(slug));
        setSync(ok ? "saved" : "local");
      } catch {
        setSync("error");
      }
    }, 800);
  }

  async function saveNow() {
    window.clearTimeout(pushTimer.current);
    setSync("saving");
    setError("");
    try {
      const ok = await saveTrackData("ers", slug, bundleFromDevice(slug));
      syncReady.current = ok;
      setSync(ok ? "saved" : "local");
      if (!ok) setError("Sign in to save your maps across devices.");
    } catch {
      setSync("error");
      setError("Account saving is unavailable. Your map remains on this device; you can retry or export it.");
    }
  }

  function persist(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      setError("");
      scheduleCloudPush();
    } catch {
      setError("Couldn't save on this device — storage may be full.");
    }
  }

  function savePalette(next: ErsColor[]) { setPalette(next); persist(ersKeys.palette, next); }
  function saveSlots(next: ErsSlotMeta[]) { setSlots(next); persist(ersKeys.slots(slug, mode), next); }
  function saveSegments(next: ErsSegment[], undoable = true) {
    if (undoable) setHistory((h) => [...h.slice(-29), segments]);
    setSegments(next);
    persist(ersKeys.map(slug, mode, slotId), next);
  }
  function undo() {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    saveSegments(prev, false);
    setSelectedSeg(null);
  }

  function switchSlot(id: string) {
    setSlotId(id);
    setSegments(loadSegments(slug, mode, id));
    setPending(null);
    setSelectedSeg(null);
    setHistory([]);
    persist(ersKeys.activeSlot(slug, mode), id);
  }

  function submitSlotName() {
    if (!slotName) return;
    const name = slotName.value.trim().slice(0, 40);
    if (!name) return setSlotName(null);
    if (slotName.mode === "rename") {
      saveSlots(slots.map((s) => (s.id === slotId ? { ...s, name } : s)));
    } else {
      const id = uid();
      const next = [...slots, { id, name }];
      saveSlots(next);
      persist(ersKeys.map(slug, mode, id), []);
      switchSlot(id);
    }
    setSlotName(null);
  }

  function duplicateSlot() {
    const id = uid();
    const name = `${slots.find((s) => s.id === slotId)?.name ?? "Slot"} copy`.slice(0, 40);
    const copy = segments.map((s) => ({ ...s, id: uid() }));
    saveSlots([...slots, { id, name }]);
    persist(ersKeys.map(slug, mode, id), copy);
    switchSlot(id);
  }

  function deleteSlot() {
    if (slots.length <= 1) return;
    const name = slots.find((s) => s.id === slotId)?.name;
    if (!window.confirm(`Delete "${name}"? Its painted sections will be lost.`)) return;
    try { localStorage.removeItem(ersKeys.map(slug, mode, slotId)); } catch {}
    const next = slots.filter((s) => s.id !== slotId);
    saveSlots(next);
    switchSlot(next[0].id);
  }

  function addColor() {
    const name = newColor.name.trim().slice(0, 30);
    if (!name) return;
    const c = { id: uid(), name, color: newColor.color };
    savePalette([...palette, c]);
    setActiveColor(c.id);
    setNewColor({ name: "", color: SWATCHES[(palette.length + 1) % SWATCHES.length] });
  }

  function removeColor(id: string) {
    const c = palette.find((x) => x.id === id);
    const used = segments.some((s) => s.colorId === id);
    if (used && !window.confirm(`"${c?.name}" is painted on this map. Remove it and its sections here?`)) return;
    savePalette(palette.filter((x) => x.id !== id));
    if (used) saveSegments(segments.filter((s) => s.colorId !== id));
    if (activeColor === id) setActiveColor(palette.find((x) => x.id !== id)?.id ?? "");
  }

  function onMapTap(e: React.PointerEvent<SVGSVGElement>) {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start || !isMapTap(start, { x: e.clientX, y: e.clientY })) return;
    if (line.length < 3) return;
    const matrix = e.currentTarget.getScreenCTM();
    if (!matrix) return;
    const local = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
    const p = { x: local.x / 1080, y: local.y / 608 };
    const hit = projectOnLine(line, p);
    if (hit.distance > SNAP) { setHint("Tap closer to the racing line."); return; }
    if (tool === "select") {
      const found = [...segments].reverse().find((s) => segmentSpan(s.start, hit.progress) <= segmentSpan(s.start, s.end));
      setSelectedSeg(found?.id ?? null);
      return;
    }
    if (!activeColor) { setHint("Add a colour first, then tap the track."); return; }
    setHint("");
    if (pending === null) { setPending(hit.progress); setSelectedSeg(null); return; }
    if (segmentSpan(pending, hit.progress) < 0.002) { setPending(null); return; }
    const seg = { id: uid(), colorId: activeColor, start: pending, end: hit.progress };
    saveSegments([...segments, seg]);
    setSelectedSeg(seg.id);
    setPending(null);
  }

  function updateSeg(id: string, patch: Partial<ErsSegment>) {
    saveSegments(segments.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function exportMaps() {
    const modes: Record<string, unknown> = {};
    for (const m of ["race", "quali"] as ErsMode[]) {
      modes[m] = loadSlots(slug, m).map((s) => ({ ...s, segments: loadSegments(slug, m, s.id) }));
    }
    const blob = new Blob([JSON.stringify({ version: 1, track: slug, palette, modes }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ers-map-${slug}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function importMaps(file: File) {
    try {
      const data = JSON.parse(await file.text());
      if (!data || data.version !== 1 || typeof data.modes !== "object") throw new Error("bad");
      const incoming: ErsColor[] = Array.isArray(data.palette) ? data.palette.filter((c: ErsColor) => c?.id && c?.name && /^#[0-9a-f]{6}$/i.test(c.color)) : [];
      const merged = [...palette, ...incoming.filter((c) => !palette.some((p) => p.id === c.id))];
      savePalette(merged);
      for (const m of ["race", "quali"] as ErsMode[]) {
        const list = Array.isArray(data.modes[m]) ? data.modes[m] : [];
        if (!list.length) continue;
        const metas: ErsSlotMeta[] = [];
        for (const s of list) {
          if (!s || typeof s.id !== "string" || typeof s.name !== "string") continue;
          metas.push({ id: s.id, name: s.name.slice(0, 40) });
          persist(ersKeys.map(slug, m, s.id), (Array.isArray(s.segments) ? s.segments : []).filter(isValidSegment));
        }
        if (metas.length) persist(ersKeys.slots(slug, m), metas);
      }
      const s = loadSlots(slug, mode);
      setSlots(s);
      switchSlot(s[0].id);
      setError("");
    } catch {
      setError("That file isn't an ERS map export.");
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (/INPUT|SELECT|TEXTAREA/.test(t.tagName)) return;
      if (e.key === "Escape") { setPending(null); setSelectedSeg(null); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const colorOf = (id: string) => palette.find((c) => c.id === id);
  const ordered = useMemo(() => lapOrder(segments), [segments]);
  const cover = useMemo(() => coverage(segments), [segments]);
  const toSvg = (pts: Point[]) => pts.map((p) => `${p.x * 1080},${p.y * 608}`).join(" ");
  const hasLine = line.length >= 3;
  const activeSlotName = slots.find((s) => s.id === slotId)?.name ?? "";

  return (
    <section className="ers-editor w-full min-w-0" aria-label="ERS map editor">
      <div className="mb-4 grid min-w-0 grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:justify-between">
        <div className="inline-flex rounded-md border border-border p-0.5" role="group" aria-label="Map type">
          {(["race", "quali"] as ErsMode[]).map((m) => (
            <Button key={m} size="sm" variant={mode === m ? "default" : "ghost"} aria-pressed={mode === m} onClick={() => setMode(m)}>
              {m === "race" ? "Race" : "Qualifying"}
            </Button>
          ))}
        </div>
        <span className="flex min-w-0 flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold ${sync === "error" ? "border-destructive/50 text-destructive" : sync === "local" ? "border-border" : "border-primary/40 text-foreground"}`} role="status">
            {sync === "local" || sync === "error" ? <CloudOff className="h-3.5 w-3.5" /> : <Cloud className="h-3.5 w-3.5" />}
            {sync === "loading" ? "Loading your maps…" : sync === "saving" ? "Saving…" : sync === "saved" ? "Synced to your account" : sync === "error" ? "Sync failed — saved on this device" : "This device only — sign in to sync"}
          </span>
          <Button variant="outline" size="sm" disabled={sync === "loading" || sync === "saving"} onClick={saveNow}><CloudUpload />{sync === "error" ? "Retry saving" : "Save now"}</Button>
          <Link to="/season/$season/track/$track/$view" params={{ season: String(season), track, view: "quali-simulation" }} search={{ cat }} className="font-semibold text-primary underline-offset-2 hover:underline">Racing line</Link>
        </span>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] lg:items-start">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-1 border-b border-border pb-2" aria-label="Map tools">
            <Button variant={tool === "paint" ? "default" : "ghost"} size="sm" aria-pressed={tool === "paint"} onClick={() => { setTool("paint"); setPending(null); }}><Pencil />Paint</Button>
            <Button variant={tool === "select" ? "default" : "ghost"} size="sm" aria-pressed={tool === "select"} onClick={() => { setTool("select"); setPending(null); }}><MousePointer2 />Select</Button>
            <Button variant="ghost" size="icon" disabled={!history.length} onClick={undo} aria-label="Undo" title="Undo"><Undo2 /></Button>
            <Button variant="ghost" size="icon" disabled={zoom === 1} onClick={() => setZoom((z) => z - 1)} aria-label="Zoom out" title="Zoom out"><ZoomOut /></Button>
            <Button variant="ghost" size="icon" disabled={zoom === 3} onClick={() => setZoom((z) => z + 1)} aria-label="Zoom in" title="Zoom in"><ZoomIn /></Button>
            <span className="text-xs tabular-nums text-muted-foreground">{zoom}×</span>
            {pending !== null && <Button variant="ghost" size="icon" onClick={() => setPending(null)} aria-label="Cancel section" title="Cancel section"><X /></Button>}
          </div>
          {palette.length > 0 && <div className="mb-2 flex gap-2 overflow-x-auto pb-1" aria-label="Paint colour">{palette.map((c) => <Button key={c.id} size="sm" variant={activeColor === c.id ? "secondary" : "outline"} aria-pressed={activeColor === c.id} className="max-w-48 shrink-0" onClick={() => setActiveColor(c.id)}><span className="h-4 w-4 shrink-0 rounded-full" style={{ background: c.color }} /><span className="truncate">{c.name}</span></Button>)}</div>}
          <div className="max-h-[60svh] min-h-48 overflow-auto overscroll-contain rounded-lg border border-border bg-card" aria-label="Zoomable circuit">
          <div className={`relative aspect-[1080/608] min-h-48 ${zoom === 3 ? "w-[300%]" : zoom === 2 ? "w-[200%]" : "w-full"}`}>
            {!imageFailed && (
              <img src={image} alt={`${track} circuit`} className="absolute inset-0 h-full w-full object-fill opacity-40" onError={() => {
                if (image !== trackMapFallbackUrl(track)) setImage(trackMapFallbackUrl(track)); else setImageFailed(true);
              }} />
            )}
            {hasLine ? (
              <svg viewBox="0 0 1080 608" preserveAspectRatio="none" className="absolute inset-0 h-full w-full cursor-crosshair touch-pan-x touch-pan-y" role="img" aria-label="ERS map — tap a start point, then an end point" onPointerDown={(e) => { if (e.isPrimary) pointerStart.current = { x: e.clientX, y: e.clientY }; }} onPointerUp={onMapTap} onPointerCancel={() => { pointerStart.current = null; }}>
                <polyline points={toSvg([...line, line[0]])} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="18" strokeLinejoin="round" className="text-foreground" />
                <polyline points={toSvg([...line, line[0]])} fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="5" strokeLinejoin="round" strokeDasharray="2 10" strokeLinecap="round" className="text-foreground" />
                {segments.map((s) => {
                  const c = colorOf(s.colorId);
                  if (!c) return null;
                  const sel = s.id === selectedSeg;
                  return (
                    <g key={s.id} className="cursor-pointer">
                      <polyline points={toSvg(sliceLine(line, s.start, s.end))} fill="none" stroke={c.color}
                        strokeWidth={sel ? 26 : 20} strokeOpacity="0.18" strokeLinecap="round" strokeLinejoin="round" />
                      <polyline points={toSvg(sliceLine(line, s.start, s.end))} fill="none" stroke={c.color}
                        strokeWidth={sel ? 13 : 9} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={selectedSeg && !sel ? 0.6 : 1} />
                    </g>
                  );
                })}
                {ordered.map((s, i) => {
                  const c = colorOf(s.colorId);
                  if (!c) return null;
                  const p = pointAtProgress(line, (s.start + segmentSpan(s.start, s.end) / 2) % 1);
                  return <g key={`l-${s.id}`} transform={`translate(${p.x * 1080} ${p.y * 608})`} className="pointer-events-none">
                    <circle r="13" fill="var(--background)" stroke={c.color} strokeWidth="3" />
                    <text textAnchor="middle" dy="5" fontSize="14" fontWeight="700" fill="currentColor" className="text-foreground">{i + 1}</text>
                  </g>;
                })}
                {(() => { const p = pointAtProgress(line, 0); return <g transform={`translate(${p.x * 1080} ${p.y * 608})`}><rect x="-4" y="-14" width="8" height="28" rx="2" fill="currentColor" className="text-foreground" /></g>; })()}
                {selectedSeg && (() => {
                  const s = segments.find((x) => x.id === selectedSeg);
                  if (!s) return null;
                  return [s.start, s.end].map((v, i) => { const p = pointAtProgress(line, v); return <circle key={i} cx={p.x * 1080} cy={p.y * 608} r="9" fill="var(--background)" stroke="currentColor" strokeWidth="4" className="text-foreground" />; });
                })()}
                {pending !== null && (() => { const p = pointAtProgress(line, pending); return <circle cx={p.x * 1080} cy={p.y * 608} r="11" fill={colorOf(activeColor)?.color ?? "currentColor"} stroke="var(--background)" strokeWidth="4" />; })()}
              </svg>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/70 p-4 text-center">
                <p className="text-sm text-muted-foreground">This track needs a racing line before you can paint it.</p>
                <Button asChild variant="outline" size="sm">
                  <Link to="/season/$season/track/$track/$view" params={{ season: String(season), track, view: "quali-simulation" }} search={{ cat }}>
                    <Pencil /> Set racing line
                  </Link>
                </Button>
              </div>
            )}
          </div>
          </div>
          <p className="mt-2 min-h-5 text-sm text-muted-foreground" role="status">
            {hint || (pending !== null ? `Start: ${pct(pending)}` : selectedSeg ? "Section selected" : "")}
          </p>

          {segments.length > 0 && (
            <div className="mt-2">
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
                {palette.filter((c) => cover[c.id]).map((c) => <div key={c.id} style={{ width: `${cover[c.id] * 100}%`, background: c.color }} />)}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {palette.filter((c) => cover[c.id]).map((c) => (
                  <span key={c.id} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />{c.name}: <b className="tabular-nums">{pct(cover[c.id])}</b></span>
                ))}
                {cover[""] > 0.0005 && <span className="text-muted-foreground">Unpainted: {pct(cover[""])}</span>}
              </div>
            </div>
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-4 border-t border-border pt-4 lg:border-t-0 lg:border-l lg:pl-4 lg:pt-0" aria-label="ERS map controls">
          <details className="order-last border-t border-border pt-3"><summary className="cursor-pointer py-2 text-sm font-semibold">Racing line tools</summary><RacingLineActions
            track={track}
            mapUrl={image}
            line={line}
            onDraft={(points) => { setLine(points); setPending(null); setSelectedSeg(null); setHint("AI draft ready. Review the route and start/finish position before exporting."); }}
          /></details>

          {/* Save slots */}
          <div>
            <div className="mb-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">Save slot</div>
            {slotName ? (
              <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); submitSlotName(); }}>
                <Input autoFocus value={slotName.value} maxLength={40} placeholder="Slot name" onChange={(e) => setSlotName({ ...slotName, value: e.target.value })} />
                <Button type="submit" size="icon" aria-label="Save slot name"><Check /></Button>
                <Button type="button" variant="ghost" size="icon" aria-label="Cancel" onClick={() => setSlotName(null)}><X /></Button>
              </form>
            ) : (
              <div className="grid grid-cols-4 gap-1">
                <select aria-label="Save slot" value={slotId} onChange={(e) => switchSlot(e.target.value)} disabled={!ready}
                  className="col-span-4 h-11 min-w-0 rounded-md border border-input bg-background px-2 text-base">
                  {slots.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <Button variant="ghost" size="icon" title="New slot" aria-label="New slot" onClick={() => setSlotName({ mode: "new", value: `Slot ${slots.length + 1}` })}><Plus /></Button>
                <Button variant="ghost" size="icon" title="Rename slot" aria-label="Rename slot" onClick={() => setSlotName({ mode: "rename", value: activeSlotName })}><Pencil /></Button>
                <Button variant="ghost" size="icon" title="Duplicate slot" aria-label="Duplicate slot" onClick={duplicateSlot}><Copy /></Button>
                <Button variant="ghost" size="icon" title="Delete slot" aria-label="Delete slot" disabled={slots.length <= 1} onClick={deleteSlot}><Trash2 /></Button>
              </div>
            )}
          </div>

          {/* Palette */}
          <div>
            <div className="mb-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">Colours</div>
            {palette.length === 0 && <p className="mb-2 text-sm text-muted-foreground">Add your first colour and name it, e.g. green = Boost.</p>}
            <div className="flex flex-col gap-1">
              {palette.map((c) => (
                <div key={c.id} className={`flex items-center gap-2 rounded-md border px-2 py-1 ${activeColor === c.id ? "border-primary bg-primary/10" : "border-transparent"}`}>
                  {editingColor === c.id ? (
                    <form className="flex min-w-0 flex-1 items-center gap-1" onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      const name = String(f.get("name") || "").trim().slice(0, 30);
                      const color = String(f.get("color") || c.color);
                      if (name) savePalette(palette.map((x) => (x.id === c.id ? { ...x, name, color } : x)));
                      setEditingColor(null);
                    }}>
                      <input type="color" name="color" defaultValue={c.color} aria-label="Colour" className="h-7 w-8 shrink-0 cursor-pointer rounded border border-input bg-transparent" />
                      <Input name="name" autoFocus defaultValue={c.name} maxLength={30} className="h-8" />
                      <Button type="submit" size="icon" variant="ghost" aria-label="Save colour"><Check /></Button>
                    </form>
                  ) : (
                    <>
                      <Button variant="ghost" className="flex min-w-0 flex-1 justify-start gap-2 px-0 text-left" aria-pressed={activeColor === c.id} onClick={() => setActiveColor(c.id)}>
                        <span className="h-4 w-4 shrink-0 rounded-full border border-border" style={{ background: c.color }} />
                        <span className="truncate text-sm font-semibold">{c.name}</span>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Edit ${c.name}`} onClick={() => setEditingColor(c.id)}><Pencil /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Remove ${c.name}`} onClick={() => removeColor(c.id)}><Trash2 /></Button>
                    </>
                  )}
                </div>
              ))}
            </div>
            <form className="mt-2 flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); addColor(); }}>
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Colour choices">
                {SWATCHES.map((s) => (
                  <Button key={s} type="button" variant="ghost" size="icon" aria-label={`Use ${s}`} aria-pressed={newColor.color === s} onClick={() => setNewColor({ ...newColor, color: s })}
                    className={newColor.color === s ? "border border-foreground" : "border border-transparent"}><span className="h-6 w-6 rounded-full" style={{ background: s }} /></Button>
                ))}
                <input type="color" aria-label="Custom colour" value={newColor.color} onChange={(e) => setNewColor({ ...newColor, color: e.target.value })} className="h-6 w-8 cursor-pointer rounded border border-input bg-transparent" />
              </div>
              <div className="flex items-center gap-1">
                <Input value={newColor.name} maxLength={30} placeholder="Name, e.g. Boost ERS" onChange={(e) => setNewColor({ ...newColor, name: e.target.value })} />
                <Button type="submit" variant="outline" disabled={!newColor.name.trim()}><Plus />Add</Button>
              </div>
            </form>
          </div>

          {/* Segments */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Sections ({segments.length})</span>
              {segments.length > 0 && <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { if (window.confirm("Clear every section in this slot?")) { saveSegments([]); setSelectedSeg(null); } }}>Clear all</Button>}
            </div>
            {segments.length === 0 && <p className="text-sm text-muted-foreground">No sections painted yet.</p>}
            <ul className="flex flex-col gap-1.5">
              {ordered.map((s, idx) => {
                const c = colorOf(s.colorId);
                const sel = s.id === selectedSeg;
                return (
                  <li key={s.id} className={`rounded-md border p-2 ${sel ? "border-primary bg-primary/5" : "border-border"}`}>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" className="h-auto min-w-0 flex-1 justify-start gap-2 px-0 text-left" onClick={() => setSelectedSeg(sel ? null : s.id)} aria-expanded={sel}>
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-background" style={{ background: c?.color }}>{idx + 1}</span>
                        <span className="min-w-0"><span className="block truncate text-sm font-semibold">{c?.name ?? "Removed colour"}</span><span className="block font-mono text-xs tabular-nums text-muted-foreground">{pct(s.start)} → {pct(s.end)} · {pct(segmentSpan(s.start, s.end))}</span></span>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Delete section" onClick={() => { saveSegments(segments.filter((x) => x.id !== s.id)); if (sel) setSelectedSeg(null); }}><Trash2 /></Button>
                    </div>
                    {sel && (
                      <div className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 lg:grid-cols-1">
                        {(["start", "end"] as const).map((edge) => (
                          <div key={edge} className="flex items-center justify-between gap-1">
                            <span className="w-10 text-muted-foreground">{edge === "start" ? "Start" : "End"}</span>
                            <Button variant="outline" size="icon" className="h-7 w-7" aria-label={`Move ${edge} back`} onClick={() => updateSeg(s.id, { [edge]: nudge(s[edge], -STEP) })}><Minus /></Button>
                            <span className="w-14 text-center font-mono tabular-nums">{pct(s[edge])}</span>
                            <Button variant="outline" size="icon" className="h-7 w-7" aria-label={`Move ${edge} forward`} onClick={() => updateSeg(s.id, { [edge]: nudge(s[edge], STEP) })}><Plus /></Button>
                          </div>
                        ))}
                        {palette.length > 1 && (
                          <select aria-label="Section colour" value={s.colorId} onChange={(e) => updateSeg(s.id, { colorId: e.target.value })}
                            className="h-8 rounded-md border border-input bg-background px-2 text-sm sm:col-span-2 lg:col-span-1">
                            {palette.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex gap-2 border-t border-border pt-3">
            <Button variant="outline" size="sm" className="flex-1" onClick={exportMaps}><Download />Export</Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={() => fileRef.current?.click()}><Upload />Import</Button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importMaps(f); e.target.value = ""; }} />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </aside>
      </div>
    </section>
  );
}
