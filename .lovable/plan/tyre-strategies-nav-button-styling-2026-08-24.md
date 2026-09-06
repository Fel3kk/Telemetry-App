# Tyre Strategies + Nav Button Styling

## 1. Style the round / season navigation buttons

On the track page the "Same track ← Season 2 / Season 4 →" and "Round 5 / 12 ← Melbourne / Monaco →" links are plain grey outlined pills. Restyle them into a single compact nav bar:

- One rounded container per group, dark inset surface, thin red left accent.
- Prev/next as arrow buttons with the track/season name, red glow on hover, arrow slides in the direction of travel.
- The "Round 5 / 12" and "Same track" labels become centred pill counters between the two arrows instead of a loose caption.
- Disabled/absent side renders a dimmed placeholder so the bar never jumps width.

Purely presentational — same links, same routing.

## 2. "Add as tyre strategy" from Race Story

Under the stint strip in Race Story (analyzer, `renderStintStrip`), add a button: **+ Add as tyre strategy**.

Clicking it reads the current session's stints (compound + start/end lap), asks for a short name (defaults to something like `Soft-Hard-Soft (S3 Race)`), and saves it to the database against the **track**, not the session. It then appears on every session/file for that track, in every season, for the active career slot.

Saved strategies render as a compact list under the stint strip:
`M 1–18 · H 19–41 · S 42–58 — "2-stop safe"` with a delete (×) and an edit pencil.

## 3. New "Possible Strategies" section

New card on the track page grid → route `/season/$season/track/$track/strategies`, rendered natively in React (no iframe), so editing is smooth.

Contents:
- List of all strategies stored for this track (from any season), each showing a coloured compound bar chart, per-stint lap ranges, total laps, and a source tag (`From race` vs `Custom`).
- **New strategy** button → editor with: name, notes, and a stint builder (add/remove stint rows; each row = compound dropdown Soft/Medium/Hard/Inter/Wet + lap count). Total laps shown live and compared to the track's known race distance.
- Every strategy is editable and deletable, including ones imported from a race.
- Optional "Duplicate" to fork an existing strategy as a starting point.

## Technical notes

### Database (new migration file `SETUP_STRATEGIES.sql`, run once in SQL Editor)

```sql
CREATE TABLE public.tyre_strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  career_slot text,
  track_key text NOT NULL,          -- trackSlug(), so it matches across seasons
  season integer,                   -- season it was imported from (null for custom)
  name text NOT NULL,
  notes text DEFAULT '',
  source text NOT NULL DEFAULT 'custom',   -- 'race' | 'custom'
  stints jsonb NOT NULL DEFAULT '[]',      -- [{compound, start_lap, end_lap}]
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tyre_strategies TO authenticated;
GRANT ALL ON public.tyre_strategies TO service_role;
ALTER TABLE public.tyre_strategies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tyre strategies" ON public.tyre_strategies
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX ON public.tyre_strategies (user_id, track_key);
```

Strategies are scoped by `user_id` + `career_slot` + `track_key`, so switching career slots swaps the list, and the same track in S1/S2/S3 shares one pool.

### Code changes

- `src/lib/strategies.ts` (new) — typed CRUD helpers over `tyre_strategies` using the existing browser Supabase client, plus compound colours and a `formatStrategy()` helper.
- `src/routes/season.$season.track.$track.strategies.tsx` (new) — Possible Strategies page (list + editor).
- `src/routes/season.$season.track.$track.index.tsx` — add the `strategies` option card, restyle the season/round nav bars.
- `public/app/script.js` (+ mirror to `docs/script.js`) — in `renderStintStrip`, append the "Add as tyre strategy" button and a saved-strategies list; insert/read via `getSupabaseClient()` with `user_id` and `career_slot` set the same way `track_notes` does.
- `public/app/styles.css` (+ `docs/styles.css`) — styles for the button and strategy rows.

### Out of scope

- Simulating lap-time/pit-loss deltas for a strategy (no pace model yet).
- Sharing strategies between career slots or users.
