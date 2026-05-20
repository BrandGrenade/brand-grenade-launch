ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS stage_2_output text,
  ADD COLUMN IF NOT EXISTS stage_2_error text;