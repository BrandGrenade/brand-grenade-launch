
-- Idempotent re-apply to refresh generated types. All objects already exist.

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS is_preflight_test boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS sessions_is_preflight_test_idx
  ON public.sessions (is_preflight_test)
  WHERE is_preflight_test = true;

CREATE TABLE IF NOT EXISTS public.preflight_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_type text NOT NULL CHECK (check_type IN ('fast', 'full')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'complete', 'failed', 'abandoned')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  tier_one_results jsonb,
  tier_two_results jsonb,
  overall_result text CHECK (overall_result IN ('ready', 'issue_detected')),
  override_used boolean NOT NULL DEFAULT false,
  override_timestamp timestamptz,
  override_reason text,
  override_session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  started_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.preflight_checks TO authenticated;
GRANT ALL ON public.preflight_checks TO service_role;

ALTER TABLE public.preflight_checks ENABLE ROW LEVEL SECURITY;
