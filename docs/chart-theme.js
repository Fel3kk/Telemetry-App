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
  const text = "#f4f4f8";
  const textDim = "#c3c3d0";
  const grid = "rgba(255,255,255,0.10)";
  const gridStrong = "rgba(255,255,255,0.22)";

  Chart.defaults.font.family =
    '"Titillium Web", "Segoe UI", system-ui, sans-serif';
  Chart.defaults.font.size = 13;
  Chart.defaults.font.weight = 600;
  Chart.defaults.color = text;
  Chart.defaults.borderColor = grid;
  Chart.defaults.scale.grid.color = grid;
  Chart.defaults.scale.grid.borderColor = gridStrong;
  Chart.defaults.scale.ticks.color = textDim;
  Chart.defaults.scale.ticks.font = { family: '"JetBrains Mono", monospace', size: 12 };
  Chart.defaults.scale.ticks.padding = 6;
  Chart.defaults.scale.grid.lineWidth = 1;
  Chart.defaults.scale.border = { color: gridStrong };
  Chart.defaults.elements.line.borderCapStyle = "round";
  Chart.defaults.elements.line.borderJoinStyle = "round";
  Chart.defaults.elements.point.hitRadius = 12;
  Chart.defaults.interaction = { mode: "index", intersect: false, axis: "x" };
  Chart.defaults.layout.padding = { top: 6, right: 8, bottom: 2, left: 2 };

  // Animation: snappier
  Chart.defaults.animation.duration = 550;
  Chart.defaults.animation.easing = "easeOutQuart";

  // Legend
  Chart.defaults.plugins.legend.labels.color = text;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.pointStyle = "rectRounded";
  Chart.defaults.plugins.legend.labels.boxHeight = 9;
  Chart.defaults.plugins.legend.labels.boxWidth = 9;
  Chart.defaults.plugins.legend.labels.padding = 14;
  Chart.defaults.plugins.legend.labels.font = {
    family: '"Titillium Web", sans-serif',
    size: 13,
    weight: "700",
  };

  // Tooltip — dark glass card with F1-red accent
  Object.assign(Chart.defaults.plugins.tooltip, {
    enabled: true,
    backgroundColor: "rgba(12, 12, 18, 0.96)",
    borderColor: "rgba(225, 6, 0, 0.55)",
    borderWidth: 1,
    titleColor: "#fff",
    titleFont: { family: '"Titillium Web", sans-serif', size: 12, weight: "700" },
    titleMarginBottom: 8,
    bodyColor: "#e8e8ee",
    bodyFont: { family: '"JetBrains Mono", monospace', size: 11 },
    bodySpacing: 4,
    padding: 12,
    cornerRadius: 8,
    boxPadding: 6,
    usePointStyle: true,
    caretSize: 6,
    displayColors: true,
    intersect: false,
    mode: "index",
  });

  // ---------- Color remap (old palette -> F1 palette) ----------
  const C = {
    red: "#ff4646",
    redFill: "rgba(225, 6, 0, 0.14)",
    redLine: "rgba(255, 45, 45, 0.9)",
    blue: "#5cb0ff",
    blueFill: "rgba(78, 160, 255, 0.14)",
    blueLine: "rgba(78, 160, 255, 0.9)",
    green: "#4bf09a",
    greenFill: "rgba(61, 220, 132, 0.14)",
    greenLine: "rgba(61, 220, 132, 0.9)",
    amber: "#ffd15c",
    amberFill: "rgba(255, 200, 71, 0.14)",
    purple: "#cf9bff",
    purpleFill: "rgba(192, 132, 252, 0.14)",
    orange: "#ff9c4f",
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
          if (ds.tension == null) ds.tension = 0.28;
          if (ds.borderWidth == null) ds.borderWidth = 3;
          if (ds.pointRadius == null) ds.pointRadius = 0;
          if (ds.pointHoverRadius == null) ds.pointHoverRadius = 6;
          if (ds.pointHoverBorderWidth == null) ds.pointHoverBorderWidth = 2;
          if (ds.pointHoverBackgroundColor == null)
            ds.pointHoverBackgroundColor = "#fff";
          if (ds.pointHoverBorderColor == null)
            ds.pointHoverBorderColor = ds.borderColor;
          if (ds.fill === undefined) ds.fill = true;
          if (ds.spanGaps === undefined) ds.spanGaps = true;
        }
        if (type === "bar" || ds.type === "bar") {
          if (ds.borderWidth == null) ds.borderWidth = 0;
          if (ds.borderRadius == null) ds.borderRadius = 6;
          if (ds.maxBarThickness == null) ds.maxBarThickness = 28;
          if (ds.borderSkipped === undefined) ds.borderSkipped = false;
        }
      });

      // Convert solid fills under line charts to soft gradients
      if (type === "line") {
        const ctx = chart.ctx;
        const area = () => chart.chartArea;
        chart.data.datasets.forEach((ds) => {
          if (!ds.fill) return;
          const base = ds.borderColor;
          if (typeof base !== "string") return;
          // Defer until after layout, using a callable backgroundColor
          ds.backgroundColor = (ctxArg) => {
            const ch = ctxArg.chart;
            const ca = ch.chartArea;
            if (!ca) return "rgba(0,0,0,0)";
            const g = ch.ctx.createLinearGradient(0, ca.top, 0, ca.bottom);
            // borderColor is hex or rgb(a); build translucent stops
            g.addColorStop(0, withAlpha(base, 0.34));
            g.addColorStop(0.6, withAlpha(base, 0.08));
            g.addColorStop(1, withAlpha(base, 0));
            return g;
          };
        });
      }
    },
  });

  // ---------- Crosshair + line glow for readability ----------
  Chart.register({
    id: "f1Crosshair",
    beforeDatasetsDraw(chart) {
      const type = chart.config.type;
      if (type !== "line") return;
      const ctx = chart.ctx;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.55)";
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 2;
    },
    afterDatasetsDraw(chart) {
      if (chart.config.type === "line") chart.ctx.restore();
      const active = chart.tooltip?.getActiveElements?.() || [];
      if (!active.length || !chart.chartArea) return;
      const x = active[0].element.x;
      const { top, bottom } = chart.chartArea;
      const ctx = chart.ctx;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.restore();
    },
  });

  function withAlpha(color, a) {
    if (!color) return `rgba(255,255,255,${a})`;
    if (color.startsWith("#")) {
      const h = color.slice(1);
      const full = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
      const r = parseInt(full.slice(0, 2), 16);
      const g = parseInt(full.slice(2, 4), 16);
      const b = parseInt(full.slice(4, 6), 16);
      return `rgba(${r},${g},${b},${a})`;
    }
    const m = color.match(/rgba?\(([^)]+)\)/);
    if (m) {
      const parts = m[1].split(",").map((s) => s.trim());
      return `rgba(${parts[0]},${parts[1]},${parts[2]},${a})`;
    }
    return color;
  }
})();
