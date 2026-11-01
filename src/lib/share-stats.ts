// Renders a shareable season-summary card to a canvas and downloads/shares it.
// Canvas output is an exported image, so it uses literal colors rather than theme tokens.

import type { SeasonSummary } from "./f1-stats";

const RED = "#e10600";
const fmt1 = (n: number | null) => (n == null ? "—" : n.toFixed(1));
const fmtPos = (n: number | null) => (n == null ? "—" : `P${n.toFixed(1).replace(/\.0$/, "")}`);

export async function shareSeasonStats(stats: SeasonSummary): Promise<"shared" | "downloaded"> {
  const W = 1080;
  const H = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  // Background with a soft red glow top-right
  ctx.fillStyle = "#0a0a0f";
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W - 120, 60, 20, W - 120, 60, 620);
  glow.addColorStop(0, "rgba(225,6,0,0.28)");
  glow.addColorStop(1, "rgba(225,6,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  // Diagonal speed stripes
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    const x = 640 + i * 70;
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 30, 0);
    ctx.lineTo(x - 170, 260);
    ctx.lineTo(x - 200, 260);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  const bar = ctx.createLinearGradient(0, 0, W, 0);
  bar.addColorStop(0, RED);
  bar.addColorStop(1, "#7a0400");
  ctx.fillStyle = bar;
  ctx.fillRect(0, 0, W, 12);

  const M = 56;
  // Header
  ctx.fillStyle = RED;
  ctx.font = "800 26px system-ui, sans-serif";
  ctx.fillText("F1 TELEMETRY · SEASON REPORT", M, 78);
  ctx.fillStyle = "#ffffff";
  ctx.font = "italic 900 84px system-ui, sans-serif";
  ctx.fillText(`SEASON ${stats.season}`, M, 162);
  ctx.font = "600 26px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText(
    `${stats.gpStarts} Grands Prix · ${stats.sprintStarts} sprints · ${stats.lapsCompleted} laps`,
    M,
    204,
  );

  // Hero row: championship position, points, avg points
  const heroY = 236;
  const heroH = 170;
  const heroGap = 20;
  const heroW = (W - M * 2 - heroGap * 2) / 3;
  const hero: [string, string, string][] = [
    ["CHAMPIONSHIP", stats.championshipPos ? `P${stats.championshipPos}` : "—", "current standing"],
    ["TOTAL POINTS", String(stats.totalPoints), `${fmt1(stats.avgPoints)} per start`],
    ["AVG FINISH", fmtPos(stats.avgFinish), `from ${fmtPos(stats.avgGrid)} avg grid`],
  ];
  hero.forEach(([label, value, sub], i) => {
    const x = M + i * (heroW + heroGap);
    glass(ctx, x, heroY, heroW, heroH, i === 0);
    ctx.font = "700 20px system-ui, sans-serif";
    ctx.fillStyle = i === 0 ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.5)";
    ctx.fillText(label, x + 26, heroY + 44);
    ctx.font = "900 70px system-ui, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(value, x + 24, heroY + 118);
    ctx.font = "500 19px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(sub, x + 26, heroY + 150);
  });

  // Stat grid: 4 columns x 4 rows
  const tiles: [string, string, string?][] = [
    ["WINS", String(stats.wins), stats.sprintWins ? `+${stats.sprintWins} sprint` : undefined],
    ["PODIUMS", String(stats.podiums)],
    ["POLES", String(stats.poles), stats.sprintPoles ? `+${stats.sprintPoles} sprint` : undefined],
    ["FASTEST LAPS", String(stats.fastestLaps)],
    ["POINTS FINISHES", String(stats.pointsFinishes)],
    ["BEST FINISH", stats.bestFinish ? `P${stats.bestFinish}` : "—"],
    ["POSITIONS", `${stats.positionsGained > 0 ? "+" : ""}${stats.positionsGained}`, "net gained"],
    ["DNFS", String(stats.dnfs)],
    ["FINISH RATE", stats.finishRate == null ? "—" : `${Math.round(stats.finishRate)}%`],
    ["Q3 APPEARANCES", String(stats.q3Apps), `of ${stats.q1Apps}`],
    ["Q2 APPEARANCES", String(stats.q2Apps), `of ${stats.q1Apps}`],
    ["Q1 EXITS", String(Math.max(0, stats.q1Apps - stats.q2Apps))],
    ["AVG QUALI", fmtPos(stats.avgQuali)],
    ["PODIUM RATE", stats.starts ? `${Math.round((stats.podiums / stats.starts) * 100)}%` : "—"],
    ["STARTS", String(stats.starts)],
    ["LAPS", String(stats.lapsCompleted)],
  ];
  const cols = 4;
  const gap = 16;
  const top = heroY + heroH + 28;
  const tileW = (W - M * 2 - gap * (cols - 1)) / cols;
  const tileH = 128;
  tiles.forEach(([label, value, sub], i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = M + col * (tileW + gap);
    const y = top + row * (tileH + gap);
    glass(ctx, x, y, tileW, tileH, false);
    ctx.font = "700 17px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(label, x + 20, y + 36);
    ctx.font = "900 48px system-ui, sans-serif";
    ctx.fillStyle = label === "DNFS" && stats.dnfs > 0 ? "#ff6b6b" : "#ffffff";
    ctx.fillText(value, x + 18, y + 92);
    if (sub) {
      ctx.font = "500 17px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.fillText(sub, x + 20, y + 116);
    }
  });

  // Footer
  ctx.font = "500 20px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  const date = new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  ctx.fillText(`Generated ${date} · F1 Telemetry Analyzer`, M, H - 34);

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Export failed"))), "image/png"),
  );
  const file = new File([blob], `f1-season-${stats.season}-stats.png`, { type: "image/png" });

  // Prefer native share sheet on mobile when it supports files.
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: `F1 Season ${stats.season} stats` });
      return "shared";
    } catch {
      // user cancelled or share failed — fall through to download
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "downloaded";
}

function glass(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, accent: boolean) {
  roundRect(ctx, x, y, w, h, 18);
  if (accent) {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, "rgba(225,6,0,0.35)");
    g.addColorStop(1, "rgba(225,6,0,0.08)");
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.045)";
  }
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = accent ? "rgba(225,6,0,0.6)" : "rgba(255,255,255,0.10)";
  ctx.stroke();
  // accent tick
  ctx.fillStyle = RED;
  ctx.fillRect(x, y + 18, 4, 26);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
