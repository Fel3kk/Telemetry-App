# Shared Strategies and Telemetry Graph Styling

## Changes

- Make possible tyre strategies user-and-track based, so the same saved strategy appears in every career slot.
- Keep new strategy records slot-neutral and include a one-time SQL update for older slot-specific records.
- Restyle all telemetry charts to match the supplied reference: flat near-black panels, subtle gridlines, compact labels, thin crisp unfilled lines, restrained tooltips, and minimal framing.
- Apply the same chart changes to the GitHub Pages copy.

## Technical details

- Remove `career_slot` from new strategy payloads and retain track-only reads.
- Add an idempotent SQL setup file that sets existing `career_slot` values to `NULL` and constrains future values to remain global.
- Update the shared Chart.js theme and any local grid overrides, then adjust chart container styling.
- Verify the app diagnostics and inspect a rendered chart at desktop and mobile sizes.
