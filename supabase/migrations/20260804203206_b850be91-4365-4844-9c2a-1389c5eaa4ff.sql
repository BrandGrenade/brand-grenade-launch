ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS stage_20l_output text,
  ADD COLUMN IF NOT EXISTS stage_20l_error text,
  ADD COLUMN IF NOT EXISTS stage_20l_medium text,
  ADD COLUMN IF NOT EXISTS stage_20l_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stage_21_fidelity jsonb;