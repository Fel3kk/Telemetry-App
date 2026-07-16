# Track Maps

Drop PNG files here, named after the `track_name` field in each saved
session (lowercased, spaces preserved). Examples:

    public/track-maps/monaco.png
    public/track-maps/silverstone.png
    public/track-maps/interlagos.png
    public/track-maps/são paulo.png

The React shell resolves `${import.meta.env.BASE_URL}track-maps/<name>.png`,
which works on both the Lovable-hosted site and GitHub Pages.

If a map file is missing the UI just shows a placeholder — no crash.
