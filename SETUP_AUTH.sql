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

-- 3b) Data API grants — no anon access, everything is owner-private
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telemetry_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_teams       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.track_notes        TO authenticated;
GRANT ALL ON public.telemetry_sessions TO service_role;
GRANT ALL ON public.driver_teams       TO service_role;
GRANT ALL ON public.track_notes        TO service_role;
REVOKE ALL ON public.telemetry_sessions FROM anon;
REVOKE ALL ON public.driver_teams       FROM anon;
REVOKE ALL ON public.track_notes        FROM anon;

-- 4) Per-user policies — a signed-in user sees & mutates only their own rows.
--    There is deliberately NO "claim orphans" policy: allowing any signed-in
--    user to UPDATE rows where user_id IS NULL lets anyone steal legacy data.

-- telemetry_sessions
CREATE POLICY "own select" ON public.telemetry_sessions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own insert" ON public.telemetry_sessions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own update" ON public.telemetry_sessions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own delete" ON public.telemetry_sessions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- driver_teams
CREATE POLICY "own select" ON public.driver_teams
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own insert" ON public.driver_teams
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own update" ON public.driver_teams
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own delete" ON public.driver_teams
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- track_notes
CREATE POLICY "own select" ON public.track_notes
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own insert" ON public.track_notes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own update" ON public.track_notes
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own delete" ON public.track_notes
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =============================================================
-- After running this, sign up in the app, then attach any legacy rows to
-- that account ONCE from this SQL editor (service role), e.g.:
--   UPDATE public.telemetry_sessions SET user_id = '<your-auth-uid>' WHERE user_id IS NULL;
--   UPDATE public.driver_teams       SET user_id = '<your-auth-uid>' WHERE user_id IS NULL;
--   UPDATE public.track_notes        SET user_id = '<your-auth-uid>' WHERE user_id IS NULL;
-- =============================================================

-- Optional: also turn OFF "Confirm email" in Auth → Providers → Email
-- so username signups work without an inbox.
