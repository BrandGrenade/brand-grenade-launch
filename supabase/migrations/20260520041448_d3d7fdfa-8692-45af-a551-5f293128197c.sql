ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS stage_3_output text,
  ADD COLUMN IF NOT EXISTS stage_3_error text;