ALTER TABLE public.stimulus_directions
  ADD COLUMN IF NOT EXISTS ratings jsonb,
  ADD COLUMN IF NOT EXISTS rating_status text NOT NULL DEFAULT 'unrated',
  ADD COLUMN IF NOT EXISTS rating_error text,
  ADD COLUMN IF NOT EXISTS rated_at timestamptz,
  ADD COLUMN IF NOT EXISTS gate_one_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gate_one_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS gate_one_notes text,
  ADD COLUMN IF NOT EXISTS gate_one_snapshot jsonb;

ALTER TABLE public.stimulus_runs
  ADD COLUMN IF NOT EXISTS tiebreaker_output text,
  ADD COLUMN IF NOT EXISTS tiebreaker_fired boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tiebreaker_reason text,
  ADD COLUMN IF NOT EXISTS tiebreaker_at timestamptz,
  ADD COLUMN IF NOT EXISTS gate_one_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gate_one_confirmed_at timestamptz;