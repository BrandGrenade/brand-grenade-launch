CREATE TABLE public.bg_hub_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bg_client_id uuid NOT NULL,
  key_id uuid NOT NULL,
  brands text[] NOT NULL CHECK (cardinality(brands) BETWEEN 1 AND 25),
  analyses text[] NOT NULL,
  market text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.bg_hub_batch_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.bg_hub_batches(id) ON DELETE CASCADE,
  brand_id text NOT NULL,
  attempt_no integer NOT NULL CHECK (attempt_no >= 1),
  kind text NOT NULL CHECK (kind IN ('initial','retry')),
  status text NOT NULL CHECK (status IN ('done','failed')),
  result jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, brand_id, attempt_no)
);
REVOKE ALL ON public.bg_hub_batches FROM anon, authenticated;
REVOKE ALL ON public.bg_hub_batch_attempts FROM anon, authenticated;
GRANT SELECT, INSERT ON public.bg_hub_batches TO service_role;
GRANT SELECT, INSERT ON public.bg_hub_batch_attempts TO service_role;
ALTER TABLE public.bg_hub_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bg_hub_batch_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON public.bg_hub_batches FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role only" ON public.bg_hub_batch_attempts FOR ALL TO service_role USING (true) WITH CHECK (true);