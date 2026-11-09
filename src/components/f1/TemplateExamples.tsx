import { useEffect, useState } from "react";
import { FileJson, Download } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "") + "/";
const FILES = {
  race: { url: `${BASE}app/telemetry_template.json`, name: "telemetry_template.json" },
  quali: { url: `${BASE}app/qualifying_template.json`, name: "qualifying_template.json" },
} as const;

const GUIDE: Record<keyof typeof FILES, [string, string][]> = {
  race: [
    ["driver_name", "Your driver name — must match your row in results and race_story"],
    ["track_name · season · created_at", "Where and when the session was driven (date decides the round order)"],
    ["starting_position · finishing_position", "Your grid slot and result"],
    ["stints", "Tyre stints with start/end lap and compound"],
    ["lap_history", "One row per lap: lap time, S1/S2/S3, tyre wear %, fuel kg, ERS, damage, pit and safety-car flags"],
    ["results", "Every driver's final position and best lap"],
    ["race_story.classification", "Final classification incl. DNFs (status RETIRED, is_dnf true)"],
    ["race_story.starting_grid · position_history", "Grid after penalties and your position each lap"],
  ],
  quali: [
    ["One object per session", "Qualifying 1 (22 cars), Qualifying 2 (16), Qualifying 3 (10)"],
    ["session_type", "\"Qualifying 1\", \"Qualifying 2\" or \"Qualifying 3\""],
    ["finishing_position", "Your position in that session"],
    ["results", "Each driver's best lap plus its sectors s1/s2/s3"],
    ["lap_history", "Your laps in the session (out lap, flying lap…)"],
    ["race_story.classification", "Best lap in ms per driver — used for personal records"],
  ],
};

// Trim a template to a short, readable preview of its structure.
function preview(json: unknown): string {
  const trim = (s: any) => {
    if (!s || typeof s !== "object") return s;
    const out: any = {};
    for (const [k, v] of Object.entries(s)) {
      if (Array.isArray(v) && v.length > 2) out[k] = [...v.slice(0, k === "lap_history" ? 2 : 1), `… ${v.length - (k === "lap_history" ? 2 : 1)} more`];
      else if (k === "race_story" && v && typeof v === "object") out[k] = trim(v);
      else out[k] = v;
    }
    return out;
  };
  const list = Array.isArray(json) ? json : [json];
  const shown = list.slice(0, 1).map(trim);
  if (list.length > 1) shown.push(`… ${list.length - 1} more session${list.length > 2 ? "s" : ""}`);
  return JSON.stringify(shown, null, 2);
}

export function TemplateExamples() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open || Object.keys(text).length) return;
    Promise.all(
      (Object.keys(FILES) as (keyof typeof FILES)[]).map(async (k) => {
        const res = await fetch(FILES[k].url);
        if (!res.ok) throw new Error(String(res.status));
        return [k, preview(await res.json())] as const;
      }),
    )
      .then((pairs) => setText(Object.fromEntries(pairs)))
      .catch(() => setFailed(true));
  }, [open, text]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          <FileJson className="h-3.5 w-3.5" /> See example format
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Example upload files</DialogTitle>
          <DialogDescription>
            Filled-in race and qualifying examples. Game exports work as they are — these show the summary format if you build files yourself.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="race" className="min-h-0">
          <TabsList>
            <TabsTrigger value="race">Race</TabsTrigger>
            <TabsTrigger value="quali">Qualifying</TabsTrigger>
          </TabsList>
          {(Object.keys(FILES) as (keyof typeof FILES)[]).map((k) => (
            <TabsContent key={k} value={k} className="mt-3 space-y-3">
              <ul className="grid gap-1.5 text-xs sm:grid-cols-2">
                {GUIDE[k].map(([field, desc]) => (
                  <li key={field} className="rounded-md border border-border bg-background/60 px-2.5 py-1.5">
                    <div className="font-mono text-[11px] font-bold text-primary">{field}</div>
                    <div className="text-muted-foreground">{desc}</div>
                  </li>
                ))}
              </ul>
              <pre className="max-h-[32vh] overflow-auto rounded-md border border-border bg-background p-3 text-[11px] leading-relaxed text-foreground/80">
                {failed ? "Preview unavailable — download the file instead." : text[k] ?? "Loading…"}
              </pre>
              <a
                href={FILES[k].url}
                download={FILES[k].name}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:opacity-90"
              >
                <Download className="h-3.5 w-3.5" /> Download {k === "race" ? "race" : "qualifying"} example
              </a>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
