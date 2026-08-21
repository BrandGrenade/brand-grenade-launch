CREATE TABLE public.intelligence_report_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.intelligence_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reason TEXT NOT NULL,
  territory_count INTEGER,
  final_report TEXT,
  report_metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_intel_report_versions_session ON public.intelligence_report_versions (session_id, created_at DESC);

GRANT SELECT ON public.intelligence_report_versions TO authenticated;
GRANT ALL ON public.intelligence_report_versions TO service_role;

ALTER TABLE public.intelligence_report_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their report versions"
ON public.intelligence_report_versions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());