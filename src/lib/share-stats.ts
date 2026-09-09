// Renders a shareable season-stats card to a canvas and downloads/shares it.

export type ShareStats = {
  season: number;
  raceWins: number;
  sprintWins: number;
  gpPoles: number;
  sprintPoles: number;
  fastestLaps: number;
  dnfs: number;
};

export async function shareSeasonStats(stats: ShareStats): Promise<"shared" | "downloaded"> {
  const W = 1080;
  const H = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  // Background
  ctx.fillStyle = "#0a0a0f";
  ctx.fillRect(0, 0, W, H);
  // Accent stripe
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, "#e10600");
  grad.addColorStop(1, "#7a0400");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, 14);

  // Header
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 64px system-ui, sans-serif";
  ctx.fillText("🏎️ F1 TELEMETRY", 64, 140);
  ctx.font = "700 40px system-ui, sans-serif";
  ctx.fillStyle = "#e10600";
  ctx.fillText(`SEASON ${stats.season} REPORT`, 64, 205);

  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(64, 245);
  ctx.lineTo(W - 64, 245);
  ctx.stroke();

  // Stats grid (2 cols x 3 rows)
  const items: [string, string, number][] = [
    ["🏆", "GP WINS", stats.raceWins],
    ["🏁", "SPRINT WINS", stats.sprintWins],
    ["⏱️", "GP POLES", stats.gpPoles],
    ["⚡", "SPRINT POLES", stats.sprintPoles],
    ["💜", "FASTEST LAPS", stats.fastestLaps],
    ["💥", "DNFS", stats.dnfs],
  ];
  const cardW = (W - 128 - 32) / 2;
  const cardH = 200;
  const gap = 32;
  items.forEach(([icon, label, value], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 64 + col * (cardW + gap);
    const y = 290 + row * (cardH + gap);
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    roundRect(ctx, x, y, cardW, cardH, 20);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.stroke();

    ctx.font = "600 26px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillText(label, x + 32, y + 60);

    ctx.font = "900 88px system-ui, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`${icon} ${value}`, x + 32, y + 160);
  });

  // Footer
  ctx.font = "500 24px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  const date = new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  ctx.fillText(`Generated ${date} · F1 Telemetry Analyzer`, 64, H - 60);

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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
