# Account saving and mobile improvements

- Retain only item 5: cross-device racing-line and ERS persistence.
- Drop previous practice-table, saved-card background, Silverstone and AI scoring/pit work.
- Improve mobile navigation, ERS touch targets, map zoom, painting and selection.
- Verify saves through an owner-scoped read-back before confirming success.

## Status

Mobile controls implemented and checked at 320px, 384px and desktop sizes. Painting, zoom and undo verified using the isolated editor; 19 focused tests pass.

Account storage setup and authenticated cross-device verification remain blocked by access to the existing external database. The owner can run `docs/track-data-setup.sql` in its SQL Editor; this preserves existing data and supplies table grants and owner-only access.