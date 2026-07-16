# F1 Analyzer Revamp — Plan

## Goal

Restructure the app into three deep-linkable levels while keeping every current feature working:

1. **Main page** (`/`) — upload, season select (persisted), season stats, track card grid
2. **Track page** (`/season/$season/track/$track`) — hero + card grid of options
3. **Option page** (`/season/$season/track/$track/$view`) — one focused view (standings, records, race-story, graphs, laps, quali, practice, compare)

Nav breadcrumb (Home ↔ Track ↔ Option) is always present.

## Approach: React shell + iframed legacy views

`public/app/script.js` is ~5,300 lines of vanilla JS that already renders every table, chart, and race-story panel correctly. Reimplementing all of it in React would take days and lose behavior.

Instead: the new React routes are the **shell** (nav, layout, season picker, track grid, hero). Views that depend on the existing rendering pipeline (`renderStandingsTable`, `buildRaceStory`, quali table, lap table, charts, records) are surfaced by iframing `public/app/index.html?season=X&track=Y&view=race-story`. Inside `script.js`, a new bootstrap reads those query params and:

- shows only the requested section (hides sidebar + other tabs)
- auto-selects the given season + saved session before rendering

This keeps the rewrite scoped to the shell while giving the user real URLs and per-view pages.

## Route structure

```
src/routes/
  __root.tsx                          # existing shell
  index.tsx                           # main page (rewritten)
  season.$season.track.$track.tsx     # layout (Outlet)
  season.$season.track.$track.index.tsx        # track hero + option grid
  season.$season.track.$track.$view.tsx        # one option, iframed
```

`$view` values: `standings | records | quali | teams | race-story | graphs | laps | practice | compare`

Season selection persists via `localStorage['f1.season']`; `/` reads it on mount and pre-selects.

## Main page (`/`)

- Header + breadcrumb
- Upload zone (drag/drop + button) — POSTs into existing Cloud tables via the same code path as today (extracted from `script.js` into a small helper module, or called through a hidden iframe on first load — TBD during build)
- Season selector chips → writes `localStorage`
- Season stats strip: GP wins, poles, sprint wins, sprint poles, podiums, fastest laps (aggregated from standings table already in DB)
- Track card grid: one card per uploaded session for the selected season. Card shows track name, session type badge(s) (Race / Quali / Sprint / Practice), tags (W, P, FL, GS, DOTD), and the track map image if present. Cards link to `/season/$s/track/$t`.

## Track page (`/season/$s/track/$t`)

- Hero: track name, session-type badges, session summary (extracted from current graphs tab's `sessionInfo`), track map image, editable notes textarea (already in DB as `track_notes`).
- Card grid of options: Standings, Records, Qualifying, Teams, Race Story, Graphs, Laps, Practice, Compare. Each links to the `$view` subroute. Cards that don't apply to the session type (e.g. Race Story on a Practice-only track) are dimmed/hidden.

## Option page (`/season/$s/track/$t/$view`)

Renders `<iframe src="/app/index.html?season=$s&track=$t&view=$view">`. Full height, no chrome (script.js hides sidebar + header + other tabs when `?view=` is present).

## Track map images

- New folder: `public/track-maps/`
- File naming: EXACT track name from saved session (spaces preserved, lowercased) + `.png` — e.g. `public/track-maps/monaco.png`, `public/track-maps/são paulo.png`
- Lookup helper: `trackMapUrl(name)` → `${import.meta.env.BASE_URL}track-maps/${slugify(name)}.png` with `onerror` fallback to a placeholder. Uses `BASE_URL` so GitHub Pages subpath works.
- No DB storage — user drops PNGs into the folder and commits.
- A `public/track-maps/README.md` explains the naming convention.

## Fault overlays on charts

In `renderChart` (Chart.js) add a shared `faultAnnotationsPlugin` that reads a per-lap fault map built during telemetry ingest:

- Parse `ers_fault`, `aero_fault`, `engine_fault`, `gearbox_fault` (and any `*_fault` field) from the telemetry frames.
- For each fault, record `{ lap, type, severity }`.
- Plugin draws a vertical dashed line at the fault's lap on Lap Times, Pace Delta, Fuel, ERS, and Tire Wear charts, colored by type, with a tooltip on hover.
- A small legend under each chart lists the fault icons.

If a session has no faults, plugin is a no-op.

## Technical notes

- `script.js` gets a new top-of-file block:
  ```js
  const qp = new URLSearchParams(location.search);
  const viewParam = qp.get('view');
  const seasonParam = qp.get('season');
  const trackParam = qp.get('track');
  if (viewParam) document.body.classList.add('embed-mode');
  ```
  CSS `.embed-mode` hides sidebar, top nav, header, and all non-matching `.collapsible-section`s; auto-selects the matching saved session on load.
- `docs/` (GitHub Pages build target) mirrors `public/app/` — both get the same script/CSS updates; the React shell only affects the Lovable-hosted app. For GitHub Pages, `docs/index.html` continues to be the full standalone app (no route change).
- The React routes only live on the Lovable-hosted TanStack site. GitHub Pages users keep the current single-page experience (documented in `docs/README.md`).
- Season persistence: `localStorage['f1.season']`, written on select, read on `/` mount.

## Out of scope for this pass

- Migrating the vanilla JS rendering into React components (would take another full pass).
- Moving track maps into DB storage (user chose file-based).
- Auth (localStorage only, user chose).

## Build order

1. Add `?season/?track/?view` handling + `.embed-mode` CSS to `public/app/script.js` and `public/app/styles.css` (and mirror to `docs/`).
2. `public/track-maps/` folder + `trackMapUrl()` helper + README.
3. Fault detection in ingest + `faultAnnotationsPlugin` in `chart-theme.js`.
4. New React routes: `/`, track layout, track index, `$view` iframe wrapper.
5. Shared components: `SeasonPicker`, `TrackCard`, `OptionCard`, `Breadcrumb`, `TrackHero`.
6. Wire main-page upload to reuse existing upload logic (either call into iframed script or extract).
7. Verify end-to-end with a sample session upload; check GitHub Pages build still works.
