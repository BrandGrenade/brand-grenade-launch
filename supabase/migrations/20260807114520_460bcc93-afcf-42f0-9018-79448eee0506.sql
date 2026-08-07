ALTER TABLE public.stimulus_prompts
  ADD COLUMN IF NOT EXISTS mandate_compliance text,
  ADD COLUMN IF NOT EXISTS mandate_carrier text,
  ADD COLUMN IF NOT EXISTS mandate_checked_at timestamp with time zone;