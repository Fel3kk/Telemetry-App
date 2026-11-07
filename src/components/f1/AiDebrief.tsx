import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/lib/supabase";
import { getActiveCareer } from "@/lib/career";
import { buildDebriefFacts } from "@/lib/race-debrief";
import { fetchDebriefSessions, type DebriefSessionRow } from "@/lib/debrief-sessions";
import { Button } from "@/components/ui/button";
import { generateDebrief, type Debrief } from "@/lib/ai-debrief.functions";

type Row = DebriefSessionRow;
type QA = { q: string; a: string };

const cacheKey = (id: string) => `f1.debrief.v1.${id}`;

export function AiDebrief({ season, track, cat = "Race" }: { season: number; track: string; cat?: string }) {
  const run = useServerFn(generateDebrief);
  const [sessions, setSessions] = useState<Row[]>([]);
  const [selected, setSelected] = useState("");
  const [status, setStatus] = useState("Loading sessions…");
  const [loadFailed, setLoadFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [debrief, setDebrief] = useState<Debrief | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [qa, setQa] = useState<QA[]>([]);
  const [question, setQuestion] = useState("");

  useEffect(() => {
    let active = true;
    setStatus("Loading sessions…");
    setLoadFailed(false);
    setSessions([]);
    setSelected("");
    (async () => {
      try {
        const rows = await fetchDebriefSessions(supabase, { season, track, cat, career: getActiveCareer() });
        if (!active) return;
        setSessions(rows);
        setSelected(rows[0]?.id ?? "");
        setStatus(rows.length ? "" : "No sessions uploaded for this weekend yet.");
      } catch {
        if (active) {
          setLoadFailed(true);
          setStatus("Saved sessions couldn't be loaded. Check your connection and try again.");
        }
      }
    })();
    return () => { active = false; };
  }, [season, track, cat, reload]);

  const session = sessions.find((s) => s.id === selected);
  const facts = useMemo(() => (session ? buildDebriefFacts(session) : null), [session]);

  useEffect(() => {
    setError(""); setQa([]); setDebrief(null);
    if (!selected) return;
    try {
      const raw = localStorage.getItem(cacheKey(selected));
      if (raw) { const c = JSON.parse(raw); setDebrief(c.debrief ?? null); setQa(c.qa ?? []); }
    } catch { /* ignore */ }
  }, [selected]);

  const save = (d: Debrief | null, q: QA[]) => {
    try { localStorage.setItem(cacheKey(selected), JSON.stringify({ debrief: d, qa: q })); } catch { /* ignore */ }
  };

  async function generate() {
    if (!facts) return;
    setBusy(true); setError("");
    try {
      const r = await run({ data: { facts: facts as Record<string, unknown> } });
      if (!r.ok) setError(r.error);
      else if (r.debrief) { setDebrief(r.debrief); save(r.debrief, qa); }
    } catch {
      setError("The engineer couldn't be reached. Try again in a moment.");
    } finally { setBusy(false); }
  }

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || !facts) return;
    setBusy(true); setError("");
    try {
      const r = await run({ data: { facts: facts as Record<string, unknown>, question: q, history: qa.slice(-6) } });
      if (!r.ok) setError(r.error);
      else if (r.answer) { const next = [...qa, { q, a: r.answer }]; setQa(next); setQuestion(""); save(debrief, next); }
    } catch {
      setError("The engineer couldn't be reached. Try again in a moment.");
    } finally { setBusy(false); }
  }

  const c = facts?.consistency as { score?: number } | null | undefined;

  return (
    <div className="space-y-4">
      {status && <p className="text-sm text-muted-foreground">{status}</p>}
      {loadFailed && <Button variant="outline" onClick={() => setReload((value) => value + 1)}>Retry loading sessions</Button>}
      {sessions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <select value={selected} onChange={(e) => setSelected(e.target.value)} className="rounded-md border border-border bg-card px-3 py-2 text-sm">
            {sessions.map((s) => <option key={s.id} value={s.id}>{s.session_type || s.category}</option>)}
          </select>
          {typeof c?.score === "number" && (
            <span className="rounded-md bg-primary/15 px-3 py-2 text-sm font-semibold text-primary">Consistency {Math.round(c.score)}/100</span>
          )}
          <button onClick={generate} disabled={busy || !facts} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {busy && !debrief ? "Engineer is reviewing…" : debrief ? "Regenerate debrief" : "Get debrief"}
          </button>
        </div>
      )}
      {error && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      {debrief && (
        <div className="space-y-4 rounded-lg border border-border bg-card p-4">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-primary text-3xl font-black italic text-primary-foreground">{debrief.grade}</div>
            <div className="min-w-0">
              <h3 className="text-lg font-bold">{debrief.headline}</h3>
              <p className="mt-1 border-l-2 border-primary pl-3 text-sm italic text-muted-foreground">📻 “{debrief.radio}”</p>
            </div>
          </div>
          <p className="text-sm">{debrief.summary}</p>
          <div className="grid gap-3 md:grid-cols-3">
            {[["Consistency", debrief.consistency], ["Tyres", debrief.tyres], ["Pace", debrief.pace]].map(([t, v]) => (
              <div key={t} className="rounded-md bg-muted/40 p-3"><div className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">{t}</div><p className="text-sm">{v}</p></div>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div><div className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Strengths</div>
              <ul className="list-disc space-y-1 pl-5 text-sm">{debrief.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
            <div><div className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Coaching notes</div>
              <ul className="space-y-1 text-sm">{debrief.improvements.map((s, i) => <li key={i}><b>{s.area}:</b> {s.detail}</li>)}</ul></div>
          </div>
        </div>
      )}

      {facts && (
        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ask your engineer</div>
          {qa.map((m, i) => (
            <div key={i} className="space-y-1 text-sm"><p className="font-semibold">You: {m.q}</p><p className="text-muted-foreground">{m.a}</p></div>
          ))}
          <form onSubmit={ask} className="flex gap-2">
            <input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={500} placeholder="e.g. Where did I lose time in stint 2?" className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm" />
            <button disabled={busy || !question.trim()} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Ask</button>
          </form>
        </div>
      )}
    </div>
  );
}
