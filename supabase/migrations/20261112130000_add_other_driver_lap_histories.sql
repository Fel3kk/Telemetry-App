ALTER TABLE public.telemetry_sessions
  ADD COLUMN IF NOT EXISTS other_driver_lap_histories jsonb NOT NULL DEFAULT '[]'::jsonb;
