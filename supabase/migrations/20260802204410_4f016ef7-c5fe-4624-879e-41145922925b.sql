ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz,
  ADD COLUMN IF NOT EXISTS stage_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS interrupted_at timestamptz,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS sessions_heartbeat_idx
  ON public.sessions (status, last_heartbeat_at)
  WHERE status = 'running';

CREATE INDEX IF NOT EXISTS sessions_user_updated_idx
  ON public.sessions (user_id, updated_at DESC);