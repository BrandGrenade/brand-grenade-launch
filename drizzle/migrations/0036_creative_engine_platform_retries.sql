ALTER TABLE public.stimulus_directions ADD COLUMN IF NOT EXISTS rewrite_error text, ADD COLUMN IF NOT EXISTS rewrite_error_at timestamptz;
ALTER TABLE public.stimulus_direction_attempts ADD COLUMN IF NOT EXISTS root_tension text, ADD COLUMN IF NOT EXISTS convergence jsonb, ADD COLUMN IF NOT EXISTS previous_convergence jsonb;
ALTER TABLE public.stimulus_prompts
  ADD COLUMN IF NOT EXISTS run_state text,
  ADD COLUMN IF NOT EXISTS fidelity_score integer,
  ADD COLUMN IF NOT EXISTS fidelity_reason text,
  ADD COLUMN IF NOT EXISTS fidelity_status text,
  ADD COLUMN IF NOT EXISTS fidelity_retries integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mandate_retries integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amendment_status text,
  ADD COLUMN IF NOT EXISTS amendment_reason text,
  ADD COLUMN IF NOT EXISTS amendment_retries integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS repair_kind text,
  ADD COLUMN IF NOT EXISTS field2_placement text,
  ADD COLUMN IF NOT EXISTS issue_resolutions jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.stimulus_prompts ADD CONSTRAINT stimulus_prompts_run_state_check CHECK (run_state IS NULL OR run_state IN ('queued','running','done','failed'));
ALTER TABLE public.stimulus_prompts ADD CONSTRAINT stimulus_prompts_repair_kind_check CHECK (repair_kind IS NULL OR repair_kind IN ('mandate','mandate_adapt','amendment','amendment_adapt','fidelity'));
ALTER TABLE public.stimulus_orchestrations ADD COLUMN IF NOT EXISTS pending_amendment text, ADD COLUMN IF NOT EXISTS repair_next text;
ALTER TABLE public.stimulus_orchestrations DROP CONSTRAINT IF EXISTS stimulus_orchestrations_status_check;
ALTER TABLE public.stimulus_orchestrations ADD CONSTRAINT stimulus_orchestrations_status_check CHECK (status IN ('pending','initial_prompts','extract','propagate','wad','cd','repair','fidelity','complete','failed'));