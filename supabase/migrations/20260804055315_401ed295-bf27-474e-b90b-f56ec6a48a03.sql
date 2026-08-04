ALTER TABLE public.stimulus_prompts
  ADD COLUMN IF NOT EXISTS gate_two_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gate_two_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS gate_two_notes text,
  ADD COLUMN IF NOT EXISTS gate_two_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS revision_log jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.stimulus_orchestrations
  ADD COLUMN IF NOT EXISTS gate_two_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gate_two_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS gate_two_notes text,
  ADD COLUMN IF NOT EXISTS gate_two_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS amendment_log jsonb NOT NULL DEFAULT '[]'::jsonb;