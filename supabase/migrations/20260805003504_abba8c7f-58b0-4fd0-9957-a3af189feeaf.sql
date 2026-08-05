ALTER TABLE public.stimulus_runs
  ADD COLUMN IF NOT EXISTS run_mode text NOT NULL DEFAULT 'channel',
  ADD COLUMN IF NOT EXISTS winning_direction_id uuid REFERENCES public.stimulus_directions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS winning_line text,
  ADD COLUMN IF NOT EXISTS winning_line_direction_id uuid REFERENCES public.stimulus_directions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz;

ALTER TABLE public.stimulus_runs ALTER COLUMN channel_brief SET DEFAULT '';

ALTER TABLE public.stimulus_directions
  ADD COLUMN IF NOT EXISTS campaign_line text,
  ADD COLUMN IF NOT EXISTS rationale text,
  ADD COLUMN IF NOT EXISTS line_check jsonb;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS locked_big_idea text,
  ADD COLUMN IF NOT EXISTS locked_campaign_line text,
  ADD COLUMN IF NOT EXISTS locked_big_idea_lens text,
  ADD COLUMN IF NOT EXISTS locked_big_idea_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_big_idea_run_id uuid;

CREATE INDEX IF NOT EXISTS stimulus_runs_session_mode_idx ON public.stimulus_runs (session_id, run_mode, created_at DESC);