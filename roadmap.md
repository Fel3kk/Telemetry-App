# Qualifying simulation

All earlier unfinished plans are dropped. Only the uploaded curvature/speed modeling request remains.

- [x] Solve curvature, braking and acceleration profiles with exact official sector timing and estimated HUD telemetry.
- [x] Cache solved profiles locally and implement account sync through existing owner-scoped track storage, invalidating on line/session/timing changes.
- [x] Add speed heatmap, corner badges, scrubber updates and mobile-friendly playback controls.
- [x] Run all 72 tests and inspect desktop/384px/320px layouts; isolated sample playback, scrubber, 4× speed, reset and device cache verified with no console errors.
- [ ] Apply supabase/quali-simulation-cache-setup.sql and verify a real saved session across devices. Blocked: existing external database requires owner access; no authenticated testing session is available. Existing published racing-line alignment is unchanged and requires independent calibration if inaccurate.
