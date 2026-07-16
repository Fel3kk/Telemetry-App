import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { appEmbedUrl, titleCaseTrack } from "@/lib/f1-shell";
import { ShellHeader, ShellPage } from "@/components/f1/ShellHeader";

export const Route = createFileRoute("/season/$season/track/$track/$view")({
  component: ViewPage,
});

const LABELS: Record<string, string> = {
  standings: "Standings",
  records: "All-Time Records",
  "quali-results": "Qualifying",
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
    setLoading(true);
    setSlow(false);
    const t = setTimeout(() => setSlow(true), 4000);
    const onMsg = (e: MessageEvent) => {
      if (e?.data && e.data.type === "f1-embed-ready") setLoading(false);
    };
    window.addEventListener("message", onMsg);
    return () => { clearTimeout(t); window.removeEventListener("message", onMsg); };
  }, [src]);

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
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-2xl font-black">{label}</h1>
          <Link
            to="/season/$season/track/$track"
            params={{ season, track }}
            search={{ cat }}
            className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/5"
          >
            ← Back to {trackDisplay}
          </Link>
        </div>
        <div className="relative overflow-hidden rounded-lg border border-white/10 bg-black/30">
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
            className="min-h-[85vh] w-full"
          />
        </div>
      </ShellPage>
    </>
  );
}
