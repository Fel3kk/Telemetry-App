# AI-assisted racing lines

Qualifying and ERS read their calibrated line from `src/data/racing-lines.json`.
AI tracing creates an in-memory draft from the selected track-map image; it does
not use qualifying lap times or movement telemetry and does not save to device
storage.

To enable AI tracing, set these server-side environment variables:

- `GEMINI_API_KEY`: Google AI Studio key (the same key used by the AI debrief).
- `RACING_LINES_ADMIN_USER_ID`: the Supabase Auth UUID of the site owner allowed
  to request AI drafts.

The map image is sent to Google Gemini for visual tracing. Review the generated
path and its start/finish point in the map before publishing. The download
contains the full shared collection: replace `src/data/racing-lines.json` with
it, commit the reviewed coordinates, and redeploy. Both Qualifying and ERS then
use the same owner-published points on every device. Replacement track-map
artwork must be independently calibrated before reusing or publishing its line.
Manual Qualifying traces can also be downloaded this way.
