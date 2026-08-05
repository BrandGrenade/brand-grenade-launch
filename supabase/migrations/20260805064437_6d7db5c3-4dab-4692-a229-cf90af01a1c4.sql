CREATE TABLE public.synthesiser_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress',
  claim_count INTEGER NOT NULL DEFAULT 0,
  applied_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.synthesiser_runs TO authenticated;
GRANT ALL ON public.synthesiser_runs TO service_role;

ALTER TABLE public.synthesiser_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own synthesiser runs"
  ON public.synthesiser_runs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX synthesiser_runs_brand_idx ON public.synthesiser_runs (brand_name, updated_at DESC);

CREATE TRIGGER update_synthesiser_runs_updated_at
  BEFORE UPDATE ON public.synthesiser_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();