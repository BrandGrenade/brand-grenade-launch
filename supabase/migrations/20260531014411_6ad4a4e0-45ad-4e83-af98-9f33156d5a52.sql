ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS phase_2_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS phase_2_current_stage integer NOT NULL DEFAULT 0;