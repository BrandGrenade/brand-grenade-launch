ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS stage_20b_audience_input jsonb,
  ADD COLUMN IF NOT EXISTS stage_20b_output text,
  ADD COLUMN IF NOT EXISTS stage_20b_error text;