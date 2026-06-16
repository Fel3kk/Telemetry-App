-- Add race_story column to persist Race Story + Pace vs Field data per session
ALTER TABLE public.telemetry_sessions
  ADD COLUMN IF NOT EXISTS race_story jsonb;
