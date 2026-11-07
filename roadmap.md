# Improvement roadmap

- [x] Performance: cache-first loading, single refetch on mount, lazy images/iframes
- [x] Feature: Title permutations (points needed per remaining race to win championship)
- [x] Feature: Personal records wall (best lap per track across all seasons, with deltas)
- [x] Feature: Share/export season stats as image
- [x] Qualifying simulation: player versus P1/P2, track map playback, timing validation, and fixture screen checks

## Uploaded implementation plan (Nov 2026)
- [x] 1. Race & Quali templates: realistic filled examples + "View example" preview in upload panel
- [x] 2. Title Race: per-season sprint weekend toggles; sprint weekends add 8 pts to max available
- [x] 3. Modded tracks (India, Hockenheim, …): flags/aliases; rounds ordered by first upload, unknown tracks join the calendar
- [x] 4. Saved-session cards: DNF shows "P4 → DNF" instead of "no result yet"
- [x] 5. Quali sim: map left, controls right on wide screens; stacked on phones
- [x] 6. Share card: total/avg points, avg finish/grid, positions gained, podiums, wins, poles, DNFs, finish rate, Q1/Q2/Q3, FL, laps
- [x] Upload accepts result-only summary files (track_name + classification, no lap data)
- [x] Records: collapsible track cards (remembered), Expand/Collapse all, sort menu (remembered)
- [x] Title Race: no fastest-lap point — 25 max per Grand Prix

## Debrief loading follow-up
- [ ] Fix saved-session loading in AI Race Engineer and verify the query against saved-session fields.
- [ ] Confirm where the shared qualifying/ERS racing line is saved.
