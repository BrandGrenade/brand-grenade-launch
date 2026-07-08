
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS loc_task_type text,
  ADD COLUMN IF NOT EXISTS loc_task_runner_up text,
  ADD COLUMN IF NOT EXISTS loc_classifier_rationale text,
  ADD COLUMN IF NOT EXISTS loc_engine_outputs jsonb,
  ADD COLUMN IF NOT EXISTS loc_validation jsonb,
  ADD COLUMN IF NOT EXISTS loc_decision_packages jsonb,
  ADD COLUMN IF NOT EXISTS loc_status text,
  ADD COLUMN IF NOT EXISTS loc_error text,
  ADD COLUMN IF NOT EXISTS loc_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS loc_retry_count integer NOT NULL DEFAULT 0;
