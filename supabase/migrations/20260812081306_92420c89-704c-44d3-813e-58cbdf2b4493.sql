ALTER TABLE public.stimulus_runs
  ADD COLUMN IF NOT EXISTS locked_big_idea_at_generation text,
  ADD COLUMN IF NOT EXISTS locked_line_at_generation text,
  ADD COLUMN IF NOT EXISTS brief_stale_ack_at timestamptz;