import { createFileRoute } from "@tanstack/react-router";
import { AllTimeRecordsPage } from "@/components/f1/AllTimeRecordsPage";

export const Route = createFileRoute("/records")({
  head: () => ({
    meta: [
      { title: "Personal Records · F1 Telemetry Analyzer" },
      { name: "description", content: "Your fastest lap on every track across all seasons." },
      { property: "og:title", content: "Personal Records · F1 Telemetry Analyzer" },
      {
        property: "og:description",
        content: "Your fastest lap on every track across all seasons.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AllTimeRecordsPage,
});
