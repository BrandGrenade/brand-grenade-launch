CREATE TABLE public.stimulus_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  channel_name text NOT NULL,
  channel_brief text NOT NULL,
  smp text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.stimulus_directions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.stimulus_runs(id) ON DELETE CASCADE,
  lens_id text NOT NULL,
  lens_name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  direction text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  instinct_brief text,
  revise_notes text,
  revise_count integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, lens_id)
);

CREATE INDEX stimulus_runs_session_idx ON public.stimulus_runs(session_id);
CREATE INDEX stimulus_directions_run_idx ON public.stimulus_directions(run_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stimulus_runs TO authenticated;
GRANT ALL ON public.stimulus_runs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stimulus_directions TO authenticated;
GRANT ALL ON public.stimulus_directions TO service_role;

ALTER TABLE public.stimulus_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stimulus_directions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Session members manage stimulus runs"
ON public.stimulus_runs FOR ALL TO authenticated
USING (public.can_access_session(session_id, auth.uid()))
WITH CHECK (public.can_access_session(session_id, auth.uid()));

CREATE POLICY "Session members manage stimulus directions"
ON public.stimulus_directions FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.stimulus_runs r WHERE r.id = run_id AND public.can_access_session(r.session_id, auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM public.stimulus_runs r WHERE r.id = run_id AND public.can_access_session(r.session_id, auth.uid())));

CREATE TRIGGER stimulus_runs_updated_at BEFORE UPDATE ON public.stimulus_runs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER stimulus_directions_updated_at BEFORE UPDATE ON public.stimulus_directions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();