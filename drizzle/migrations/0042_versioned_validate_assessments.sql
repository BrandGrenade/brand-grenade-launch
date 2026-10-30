CREATE TABLE public.validate_assessments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid NOT NULL REFERENCES public.sessions(id), run_version integer NOT NULL CHECK(run_version > 0), assessment_revision integer NOT NULL DEFAULT 1 CHECK(assessment_revision > 0), subject_brand text NOT NULL, mode text NOT NULL DEFAULT 'validate' CHECK(mode='validate'), entry_path text NOT NULL CHECK(entry_path IN ('addon','new')), brief jsonb NOT NULL, source_kind text NOT NULL CHECK(source_kind IN ('client','BG-derived','unverified')), source_baseline_job uuid REFERENCES public.current_position_addon_jobs(id), source_fingerprint text NOT NULL, outputs jsonb NOT NULL, actor_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(session_id,run_version,assessment_revision)
);
GRANT SELECT ON public.validate_assessments TO authenticated;
GRANT ALL ON public.validate_assessments TO service_role;
ALTER TABLE public.validate_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Existing run access reads Validate assessments" ON public.validate_assessments FOR SELECT TO authenticated USING (public.can_access_session(session_id,auth.uid()) OR public.bg_is_admin(auth.uid()));
CREATE FUNCTION public.bg_validate_assessment_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'VALIDATE_ASSESSMENT_IMMUTABLE: append a new assessment revision'; END $$;
CREATE TRIGGER bg_validate_assessment_immutable BEFORE UPDATE OR DELETE ON public.validate_assessments FOR EACH ROW EXECUTE FUNCTION public.bg_validate_assessment_immutable();
COMMENT ON TABLE public.validate_assessments IS 'Immutable Validate output revisions attached to an exact source-run version. Never overwrite Campaign/Deal outputs or mutate source sessions.';