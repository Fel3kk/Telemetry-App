# Improvement roadmap

## Current follow-up
- [x] Respect each session file's constructor and prevent cross-season team fallback (Feledziak: Williams in the affected season).
- [x] Remove the photo above Notes/Sections on the track hub.
- [x] Run team regression tests and check qualifying with a conflicting assignment (15 tests passed; browser shows Williams).
- [ ] Verify the photo-free hub with saved data (blocked: no available signed-in session; page redirects to sign-in).

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
- [x] Fix saved-session loading in AI Race Engineer and verify the query against saved-session fields (live query accepted; eight tests pass; signed-in debrief remains unverified).
- [x] Confirm where the shared qualifying/ERS racing line is saved: per track in browser localStorage, shared across seasons/career slots on the same origin/device.

## Owner-published racing lines
- [ ] Use one published collection for Qualifying and ERS on every device, without user line creation.
- [ ] Add a bulk export of old device-saved lines so the owner can submit them here.
- [ ] Publish the owner's full collection (waiting for the uploaded collection).

## November 8 priorities
- [ ] Universal driver matching, constructor aliases, and automatic team ingest.
- [ ] Qualifying lap roles and push-only coaching (108% threshold).
- [ ] Verified pit stops; ignore isolated compound artifacts.
- [ ] Automatic shared trend-residual consistency.
- [ ] Upload-triggered debrief generation and cache reuse.
- [ ] Three remembered weekend navigation categories.
- [ ] Shared owner-curated racing lines without per-user drafting.
