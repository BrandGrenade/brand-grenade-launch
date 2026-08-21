CREATE TABLE IF NOT EXISTS public.job_supervision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  job_id text NOT NULL,
  owner_user_id uuid,
  state text NOT NULL DEFAULT 'watching',
  attempts integer NOT NULL DEFAULT 0,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  last_error text,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (domain, job_id)
);

GRANT SELECT ON public.job_supervision TO authenticated;
GRANT ALL ON public.job_supervision TO service_role;

ALTER TABLE public.job_supervision ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their supervision rows"
ON public.job_supervision FOR SELECT TO authenticated
USING (owner_user_id = auth.uid());

CREATE TRIGGER job_supervision_touch
BEFORE UPDATE ON public.job_supervision
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS job_supervision_state_idx ON public.job_supervision (state, next_attempt_at);