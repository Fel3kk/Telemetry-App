-- =============================================================
-- F1 Telemetry — one-time SQL to enable per-user accounts.
-- Run this in your Supabase project's SQL Editor.
-- =============================================================

-- 1) Add user_id ownership columns (nullable so existing rows keep working)
ALTER TABLE public.telemetry_sessions ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.driver_teams       ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.track_notes        ADD COLUMN IF NOT EXISTS user_id uuid;

CREATE INDEX IF NOT EXISTS telemetry_sessions_user_id_idx ON public.telemetry_sessions(user_id);
CREATE INDEX IF NOT EXISTS driver_teams_user_id_idx       ON public.driver_teams(user_id);
CREATE INDEX IF NOT EXISTS track_notes_user_id_idx        ON public.track_notes(user_id);

-- 2) Enable RLS
ALTER TABLE public.telemetry_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_teams       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.track_notes        ENABLE ROW LEVEL SECURITY;

-- 3) Drop any old permissive policies (safe if they don't exist)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname='public'
      AND tablename IN ('telemetry_sessions','driver_teams','track_notes')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- 4) Per-user policies — a signed-in user sees & mutates only their own rows
--    PLUS a one-time "claim orphans": authenticated users may update rows where
--    user_id IS NULL (used once on first login to attach legacy data to Felek).

-- telemetry_sessions
CREATE POLICY "own select" ON public.telemetry_sessions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own insert" ON public.telemetry_sessions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own update" ON public.telemetry_sessions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own delete" ON public.telemetry_sessions
  FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "claim orphans" ON public.telemetry_sessions
  FOR UPDATE TO authenticated USING (user_id IS NULL) WITH CHECK (user_id = auth.uid());

-- driver_teams
CREATE POLICY "own select" ON public.driver_teams
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own insert" ON public.driver_teams
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own update" ON public.driver_teams
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own delete" ON public.driver_teams
  FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "claim orphans" ON public.driver_teams
  FOR UPDATE TO authenticated USING (user_id IS NULL) WITH CHECK (user_id = auth.uid());

-- track_notes
CREATE POLICY "own select" ON public.track_notes
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own insert" ON public.track_notes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own update" ON public.track_notes
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own delete" ON public.track_notes
  FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "claim orphans" ON public.track_notes
  FOR UPDATE TO authenticated USING (user_id IS NULL) WITH CHECK (user_id = auth.uid());

-- =============================================================
-- After running this, open the app, sign up with username "felek"
-- and any password. On first login the app auto-claims every row
-- where user_id IS NULL, attaching all existing data to Felek.
-- Later signups will start with an empty, private account.
-- =============================================================

-- Optional: also turn OFF "Confirm email" in Auth → Providers → Email
-- so username signups work without an inbox.
