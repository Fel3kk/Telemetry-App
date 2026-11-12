# Qualifying simulation only

Earlier unfinished work is dropped at the user's request. Scope is limited to the uploaded curvature/speed modeling document.

- Curvature-derived 120-point speed profiles, two-pass braking/acceleration and official sector/lap timing.
- Versioned device cache and owner-scoped account sync keyed by geometry, qualifying session and official timings.
- Estimated speed/gear/pedals, optional speed heatmap, numbered apexes, instant scrubbing and 1×/2×/4× mobile controls.

Implemented and tested: 72 tests pass; isolated sample playback and desktop/384px/320px layouts checked. Applying the account-cache SQL upgrade and verifying a real saved session across devices require access to the existing external database and a signed-in account.