ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS stage_4b_output text,
  ADD COLUMN IF NOT EXISTS stage_4b_error text;