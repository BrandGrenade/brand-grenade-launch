ALTER TABLE public.stimulus_orchestrations
  ADD COLUMN IF NOT EXISTS driver_status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS driver_heartbeat_at timestamptz,
  ADD COLUMN IF NOT EXISTS driver_started_at timestamptz;