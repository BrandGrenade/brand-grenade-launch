CREATE TABLE public.tier2_harness_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL,
  donor_session_id UUID,
  phase TEXT NOT NULL DEFAULT 'stage20',
  status TEXT NOT NULL DEFAULT 'running',
  attempts INTEGER NOT NULL DEFAULT 0,
  claimed_at TIMESTAMPTZ,
  result_detail TEXT,
  log JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tier2_harness_runs TO authenticated;
GRANT ALL ON public.tier2_harness_runs TO service_role;
ALTER TABLE public.tier2_harness_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view harness runs" ON public.tier2_harness_runs FOR SELECT TO authenticated USING (true);
CREATE TRIGGER tier2_harness_runs_touch BEFORE UPDATE ON public.tier2_harness_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX tier2_harness_runs_status_idx ON public.tier2_harness_runs (status, created_at);