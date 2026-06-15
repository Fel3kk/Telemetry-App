import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "F1 Telemetry Analyzer" },
      { name: "description", content: "Analyze F1 telemetry sessions, standings, qualifying results, stint summaries, and lap data." },
      { property: "og:title", content: "F1 Telemetry Analyzer" },
      { property: "og:description", content: "Analyze F1 telemetry sessions, standings, qualifying results, stint summaries, and lap data." },
    ],
  }),
  component: Index,
});

function Index() {
  return <iframe title="F1 Telemetry Analyzer" src="/app/index.html" className="h-screen w-screen border-0" />;
}
