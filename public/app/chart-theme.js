/* ================================================================
   F1 Chart Theme & Polish Layer
   Loaded BEFORE script.js. Patches Chart.js defaults and registers
   a plugin that remaps the old hardcoded palette + smooths lines.
   Original chart code in script.js is left untouched.
   ================================================================ */
(function () {
  if (typeof Chart === "undefined") return;

  // ---------- Global defaults ----------
  const css = getComputedStyle(document.documentElement);
  const text = "#e7e7ec";
  const textDim = "#858794";
  const grid = "rgba(255,255,255,0.065)";
  const gridStrong = "rgba(255,255,255,0.16)";

  Chart.defaults.font.family =
    '"Titillium Web", "Segoe UI", system-ui, sans-serif';
  Chart.defaults.font.size = 12;
  Chart.defaults.font.weight = 500;
  Chart.defaults.color = text;
  Chart.defaults.borderColor = grid;
  Chart.defaults.scale.grid.color = grid;
  Chart.defaults.scale.grid.lineWidth = 1;
  Chart.defaults.scale.grid.tickLength = 5;
  Chart.defaults.scale.border.color = gridStrong;
  Chart.defaults.scale.border.width = 1;
  Chart.defaults.scale.ticks.color = textDim;
  Chart.defaults.scale.ticks.padding = 8;
  Chart.defaults.scale.ticks.font = { family: '"JetBrains Mono", monospace', size: 10 };

  // Animation: snappier
  Chart.defaults.animation.duration = 420;
  Chart.defaults.animation.easing = "easeOutQuart";

  // Legend
  Chart.defaults.plugins.legend.labels.color = text;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.pointStyle = "rectRounded";
  Chart.defaults.plugins.legend.labels.boxHeight = 8;
  Chart.defaults.plugins.legend.labels.padding = 14;
  Chart.defaults.plugins.legend.labels.font = {
    family: '"Titillium Web", sans-serif',
    size: 12,
    weight: "600",
  };

  // Tooltip — restrained telemetry panel
  Object.assign(Chart.defaults.plugins.tooltip, {
    enabled: true,
    backgroundColor: "rgba(12, 12, 18, 0.96)",
    borderColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    titleColor: "#fff",
    titleFont: { family: '"Titillium Web", sans-serif', size: 12, weight: "700" },
    titleMarginBottom: 8,
    bodyColor: "#e8e8ee",
    bodyFont: { family: '"JetBrains Mono", monospace', size: 11 },
    bodySpacing: 4,
    padding: 12,
    cornerRadius: 4,
    boxPadding: 6,
    usePointStyle: true,
    caretSize: 6,
    displayColors: true,
    intersect: false,
    mode: "index",
  });

  // ---------- Color remap (old palette -> F1 palette) ----------
  const C = {
    red: "#ff2d2d",
    redFill: "rgba(225, 6, 0, 0.14)",
    redLine: "rgba(255, 45, 45, 0.9)",
    blue: "#4ea0ff",
    blueFill: "rgba(78, 160, 255, 0.14)",
    blueLine: "rgba(78, 160, 255, 0.9)",
    green: "#3ddc84",
    greenFill: "rgba(61, 220, 132, 0.14)",
    greenLine: "rgba(61, 220, 132, 0.9)",
    amber: "#ffc847",
    amberFill: "rgba(255, 200, 71, 0.14)",
    purple: "#c084fc",
    purpleFill: "rgba(192, 132, 252, 0.14)",
    orange: "#ff8a3d",
    orangeFill: "rgba(255, 138, 61, 0.14)",
  };

  const REMAP = {
    "#667eea": C.blue,
    "rgba(102, 126, 234, 0.1)": C.blueFill,
    "rgba(102, 126, 234, 0.8)": C.blueLine,
    "#ff6b6b": C.red,
    "rgba(255, 107, 107, 0.1)": C.redFill,
    "rgba(255, 107, 107, 0.8)": C.redLine,
    "#ffd93d": C.amber,
    "#51cf66": C.green,
    "rgba(81, 207, 102, 0.1)": C.greenFill,
    "rgba(81, 207, 102, 0.8)": C.greenLine,
    "#ffd43b": C.amber,
    "#a78bfa": C.purple,
    "#ff922b": C.orange,
    "rgba(255, 146, 43, 0.1)": C.orangeFill,
  };

  function remap(v) {
    if (typeof v !== "string") return v;
    return REMAP[v] || REMAP[v.replace(/\s+/g, "")] || v;
  }

  // ---------- Plugin: polish every dataset on init ----------
  Chart.register({
    id: "f1Polish",
    beforeInit(chart) {
      const type = chart.config.type;
      const datasets = chart.data?.datasets || [];
      datasets.forEach((ds) => {
        // Color remap
        ds.borderColor = remap(ds.borderColor);
        ds.backgroundColor = remap(ds.backgroundColor);
        ds.pointBackgroundColor = remap(ds.pointBackgroundColor);
        ds.pointBorderColor = remap(ds.pointBorderColor);
        ds.pointHoverBackgroundColor = remap(ds.pointHoverBackgroundColor);

        if (type === "line" || ds.type === "line") {
          if (ds.tension == null) ds.tension = 0.18;
          if (ds.borderWidth == null) ds.borderWidth = 1.8;
          if (ds.pointRadius == null) ds.pointRadius = 0;
          if (ds.pointHoverRadius == null) ds.pointHoverRadius = 5;
          if (ds.pointHoverBorderWidth == null) ds.pointHoverBorderWidth = 2;
          if (ds.pointHoverBackgroundColor == null)
            ds.pointHoverBackgroundColor = "#fff";
          if (ds.pointHoverBorderColor == null)
            ds.pointHoverBorderColor = ds.borderColor;
          ds.fill = false;
          if (ds.spanGaps === undefined) ds.spanGaps = true;
        }
        if (type === "bar" || ds.type === "bar") {
          if (ds.borderWidth == null) ds.borderWidth = 0;
          if (ds.borderRadius == null) ds.borderRadius = 6;
          if (ds.maxBarThickness == null) ds.maxBarThickness = 28;
          if (ds.borderSkipped === undefined) ds.borderSkipped = false;
        }
      });

    },
  });
})();
