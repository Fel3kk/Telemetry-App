import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { appEmbedUrl, titleCaseTrack } from "@/lib/f1-shell";
import { ShellHeader, ShellPage } from "@/components/f1/ShellHeader";
import { QualifyingSimulation } from "@/components/f1/QualifyingSimulation";

export const Route = createFileRoute("/season/$season/track/$track/$view")({
  head: ({ params }) => {
    const title = `${LABELS[params.view] ?? params.view} · ${titleCaseTrack(params.track)} · F1 Telemetry`;
    const description = `Season ${params.season} ${titleCaseTrack(params.track)} ${LABELS[params.view] ?? params.view} from your uploaded F1 telemetry.`;
    return { meta: [{ title }, { name: "description", content: description }, { property: "og:title", content: title }, { property: "og:description", content: description }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] };
  },
  component: ViewPage,
});

const LABELS: Record<string, string> = {
  standings: "Standings",
  records: "All-Time Records",
  progress: "Season Progress",
  "quali-results": "Qualifying",
  "quali-simulation": "Qualifying Simulation",
  grid: "Starting Grid",
  assignments: "Teams",
  "race-story": "Race Story",
  compare: "Compare Lap Times",
  graphs: "Graphs",
  data: "Laps",
  practice: "Practice",
};

function ViewPage() {
  const { season, track, view } = Route.useParams();
  const { cat } = Route.useSearch();
  const label = LABELS[view] ?? view;
  const trackDisplay = titleCaseTrack(track);
  const src = appEmbedUrl({ season: Number(season), track, view, cat });
  const [loading, setLoading] = useState(true);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (view === "quali-simulation") return;
    setLoading(true);
    setSlow(false);
    const t = setTimeout(() => setSlow(true), 4000);
    const onMsg = (e: MessageEvent) => {
      if (e?.data && e.data.type === "f1-embed-ready") setLoading(false);
    };
    window.addEventListener("message", onMsg);
    return () => { clearTimeout(t); window.removeEventListener("message", onMsg); };
  }, [src, view]);

  return (
    <>
      <ShellHeader
        crumbs={[
          { label: `Season ${season}`, to: "/" },
          {
            label: cat ? `${trackDisplay} · ${cat}` : trackDisplay,
            to: "/season/$season/track/$track",
            params: { season, track },
            search: { cat },
          },
          { label },
        ]}
      />
      <ShellPage>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h1 className="min-w-0 truncate text-xl font-black sm:text-2xl">{label}</h1>
          <Link
            to="/season/$season/track/$track"
            params={{ season, track }}
            search={{ cat }}
            className="shrink-0 rounded-md border border-white/15 px-3 py-1.5 text-[11px] font-semibold hover:bg-white/5 sm:text-xs"
          >
            ← Back to {trackDisplay}
          </Link>
        </div>
        {view === "quali-simulation" ? <QualifyingSimulation season={Number(season)} track={track} cat={cat} /> : <div className="relative overflow-hidden rounded-lg border border-white/10 bg-black/30">
          {loading && (
            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#0a0a0f]/90 backdrop-blur-sm">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-red-500" />
              <div className="text-sm font-semibold text-white/80">Loading {label}…</div>
              <div className="text-xs text-white/40">
                {slow ? "Fetching telemetry from the database (first load can take 10–15s)" : "Preparing charts and race data"}
              </div>
            </div>
          )}
          <iframe
            key={src}
            title={label}
            src={src}
            className="min-h-[70vh] w-full sm:min-h-[85vh]"
          />
        </div>}
      </ShellPage>
    </>
  );
}
