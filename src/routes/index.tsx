import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "F1 Telemetry Analyzer" },
      { name: "description", content: "Slick dark F1-inspired telemetry analyzer for race, qualifying, sprint and practice data." },
      { property: "og:title", content: "F1 Telemetry Analyzer" },
      { property: "og:description", content: "Slick dark F1-inspired telemetry analyzer for race, qualifying, sprint and practice data." },
    ],
  }),
  component: Index,
});

function Index() {
  useEffect(() => {
    window.location.replace("/app/index.html");
  }, []);
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#07070a", color: "#f5f5f7", fontFamily: "system-ui" }}>
      Loading F1 Telemetry Analyzer…
    </div>
  );
}
