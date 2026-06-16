## Goal
Use the rich per-session JSON (which contains `position-history`, `overtakes`, `speed-trap-records`, `tyre-stint-history-v2`, plus the player's `per-lap-info` / `lap-time-history`) to add player-focused race-story charts to the analyzer. Everything keys off the entry where `is-player: true`, matching what already exists in `script.js`.

## New visualizations

1. **Position Changes Through the Race** (primary request)
   - Line chart, x = lap, y = track position (inverted: P1 on top, integer ticks).
   - Player line in bold F1 red, with start/end position labels and a marker at the lowest/highest position reached.
   - Optional faint comparison lines for the eventual podium finishers (top 3 from `final-classification`) using their team colors — toggleable in the legend.
   - Data source: `position-history[*].driver-position-history`.

2. **Overtakes Timeline**
   - Compact stacked bar (or dot strip) per lap showing overtakes the player **made** vs overtakes **suffered**, plus a small list of "Notable battles" (opponent + lap).
   - Data source: `overtakes.records`, filtered where the player is overtaking-driver or overtaken-driver.

3. **Lap Pace vs Field Average**
   - Line chart of player's lap time minus the median lap time of all classified drivers that lap (delta-to-median).
   - Highlights stints visually using `tyre-stint-history-v2` (background bands shaded by compound color).
   - Data source: each driver's `lap-time-history.lap-history-data`.

4. **Tyre Stint Strategy Strip**
   - Horizontal stint bar for the player showing each stint's lap range and compound (color-coded: soft red, medium yellow, hard white, inters green, wet blue), with pit-stop markers.
   - Data source: player's `tyre-stint-history-v2` / `tyre-set-history`.

5. **Top Speed Leaderboard (mini widget)**
   - Small ranked list of top 5 speed-trap entries with the player highlighted (and their delta to the leader).
   - Data source: `speed-trap-records`.

## UI placement
- Add a new collapsible tab **"Race Story"** at the top of the charts section containing: Position Changes, Overtakes Timeline, Tyre Stint Strip, Top Speed widget.
- Add **"Pace vs Field"** chart into the existing **Lap Times** tab right under the lap-times chart.
- All charts reuse the existing `createChart()` helper + `chart-theme.js` styling for the F1 dark look, and inherit mobile sticky-filter / snap-scroll behavior already in `styles.css`.

## Technical details
- All work stays in `public/app/` — no backend, no schema changes.
- `script.js`:
  - Add helpers `getPlayer(data)`, `getOvertakesForPlayer(data, playerName)`, `getPaceDeltaSeries(data, playerName)`, `getStints(player)`.
  - Add `renderPositionChart()`, `renderOvertakesChart()`, `renderPaceDeltaChart()`, `renderStintStrip()`, `renderTopSpeedWidget()` and call them from `renderCharts()`.
  - Reuse Chart.js (already loaded). Stint strip uses a horizontal stacked bar; speed widget is plain DOM.
- `index.html`: add the new `<canvas>` elements and the "Race Story" collapsible tab block, plus a small container `<div id="topSpeedList">`.
- `styles.css`: minor additions for the stint strip and top-speed list — reuse existing tokens (`--bg-2`, `--accent`, compound colors as new CSS vars: `--c-soft`, `--c-medium`, `--c-hard`, `--c-inter`, `--c-wet`).
- `chart-theme.js`: extend palette with team-color map used by the position chart legend lines.

## Out of scope
- Non-player driver deep dives (data only used as context: median pace, podium comparison, overtake counterparties).
- Any persistence/Cloud backend; sessions continue to load from the existing upload + saved-sessions flow.

## Verification
- Load the provided Catalunya JSON via the existing upload UI, open Race Story tab, confirm: player position line goes from P? → final, overtakes bars match `overtakes.records` count for SAINZ (the player in this file), pace-delta chart renders, stint strip shows compound colors with pit markers, top-speed widget highlights the player row.
- Mobile viewport (390px): tab snaps, charts scroll horizontally, stint strip is full-width.
