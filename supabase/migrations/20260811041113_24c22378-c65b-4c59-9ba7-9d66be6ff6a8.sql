ALTER TABLE public.stimulus_directions
  ADD COLUMN IF NOT EXISTS root_tension text,
  ADD COLUMN IF NOT EXISTS convergence jsonb,
  ADD COLUMN IF NOT EXISTS convergence_regen_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.stimulus_runs
  ADD COLUMN IF NOT EXISTS convergence_ledger jsonb,
  ADD COLUMN IF NOT EXISTS convergence_ledger_at timestamptz;