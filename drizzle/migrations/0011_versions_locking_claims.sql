-- Run lock + version bookkeeping columns. Existing rows: earlier_versions_kept = false (no invented history).
ALTER TABLE public.sessions
  ADD COLUMN locked_at timestamptz, ADD COLUMN locked_by uuid, ADD COLUMN lock_reason text,
  ADD COLUMN earlier_versions_kept boolean NOT NULL DEFAULT false,
  ADD COLUMN version_reason text, ADD COLUMN version_actor uuid;
ALTER TABLE public.sessions ALTER COLUMN earlier_versions_kept SET DEFAULT true;
ALTER TABLE public.briefing_room_workspaces
  ADD COLUMN locked_at timestamptz, ADD COLUMN locked_by uuid, ADD COLUMN lock_reason text,
  ADD COLUMN earlier_versions_kept boolean NOT NULL DEFAULT false,
  ADD COLUMN version_reason text, ADD COLUMN version_actor uuid;
ALTER TABLE public.briefing_room_workspaces ALTER COLUMN earlier_versions_kept SET DEFAULT true;
ALTER TABLE public.synthesiser_runs ADD COLUMN claims_stored boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.sessions.version_reason IS 'Transient: reason for the next version snapshot; consumed and cleared by bg_version_and_lock.';
COMMENT ON COLUMN public.sessions.version_actor IS 'Transient: actor for the next version snapshot; consumed and cleared by bg_version_and_lock.';
COMMENT ON COLUMN public.briefing_room_workspaces.version_reason IS 'Transient: consumed and cleared by bg_version_and_lock.';
COMMENT ON COLUMN public.briefing_room_workspaces.version_actor IS 'Transient: consumed and cleared by bg_version_and_lock.';

CREATE TABLE public.run_output_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_table text NOT NULL CHECK (run_table IN ('sessions','briefing_room_workspaces')),
  run_id uuid NOT NULL,
  field text NOT NULL,
  version_no integer NOT NULL,
  content jsonb NOT NULL,
  reason text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_table, run_id, field, version_no)
);
CREATE INDEX run_output_versions_run_idx ON public.run_output_versions (run_table, run_id);
GRANT SELECT ON public.run_output_versions TO authenticated;
GRANT ALL ON public.run_output_versions TO service_role;
ALTER TABLE public.run_output_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Run members and admins read versions" ON public.run_output_versions FOR SELECT TO authenticated
USING (
  public.bg_is_admin(auth.uid())
  OR (run_table = 'sessions' AND public.can_access_session(run_id, auth.uid()))
  OR (run_table = 'briefing_room_workspaces' AND EXISTS (SELECT 1 FROM public.briefing_room_workspaces w WHERE w.id = run_id AND w.user_id = auth.uid()))
);

CREATE TABLE public.synthesiser_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  synthesiser_run_id uuid NOT NULL REFERENCES public.synthesiser_runs(id),
  heading text NOT NULL,
  claim_text text NOT NULL,
  label text NOT NULL CHECK (label IN ('verified','unverified','contradicted','client_supplied','not_checked')),
  source text,
  source_date date,
  position integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (synthesiser_run_id, position)
);
GRANT SELECT, INSERT ON public.synthesiser_claims TO authenticated;
GRANT ALL ON public.synthesiser_claims TO service_role;
ALTER TABLE public.synthesiser_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Run owners and admins read claims" ON public.synthesiser_claims FOR SELECT TO authenticated
USING (public.bg_is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.synthesiser_runs r WHERE r.id = synthesiser_run_id AND r.user_id = auth.uid()));
CREATE POLICY "Run owners add claims" ON public.synthesiser_claims FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.synthesiser_runs r WHERE r.id = synthesiser_run_id AND r.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.bg_output_field(_table text, _k text, _versioned boolean) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _table
    WHEN 'sessions' THEN
      (_k ~ '_outputs?$' OR _k IN ('stage_12_smps','loc_engine_outputs','loc_decision_packages','loc_validation'))
      OR (NOT _versioned AND (_k LIKE 'selected\_%' OR _k LIKE 'checkpoint\_%' OR _k LIKE 'locked\_big\_idea%'
          OR _k IN ('locked_campaign_line','brief_text','stage_amendments','brief_versions','selection_rationale')))
    WHEN 'briefing_room_workspaces' THEN
      _k IN ('diagnosis','truths','relevance','tensions')
      OR (NOT _versioned AND _k IN ('raw_brief','supporting_evidence','selected_frame','selected_tension_index','brand_name','category'))
    ELSE false END
$$;

CREATE OR REPLACE FUNCTION public.bg_version_and_lock() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n jsonb := to_jsonb(NEW); o jsonb := to_jsonb(OLD); k text;
  app boolean := current_user IN ('authenticated','anon');
  streaming boolean := false; reason text; actor uuid; vno integer;
  was_done boolean; now_done boolean;
BEGIN
  IF (n->'locked_at') IS DISTINCT FROM (o->'locked_at') OR (n->'locked_by') IS DISTINCT FROM (o->'locked_by')
     OR (n->'lock_reason') IS DISTINCT FROM (o->'lock_reason') THEN
    IF app THEN RAISE EXCEPTION 'Only an admin can lock a run.' USING ERRCODE = '42501'; END IF;
    IF jsonb_typeof(o->'locked_at') <> 'null' THEN RAISE EXCEPTION 'This run is locked and cannot be unlocked.' USING ERRCODE = 'P0001'; END IF;
  END IF;
  IF TG_TABLE_NAME = 'sessions' THEN streaming := coalesce(o->>'stage_status','') LIKE 'running%'; END IF;
  reason := nullif(n->>'version_reason',''); actor := coalesce(auth.uid(), nullif(n->>'version_actor','')::uuid);
  FOR k IN SELECT jsonb_object_keys(o) LOOP
    CONTINUE WHEN NOT public.bg_output_field(TG_TABLE_NAME, k, false);
    CONTINUE WHEN (n->k) IS NOT DISTINCT FROM (o->k);
    IF jsonb_typeof(o->'locked_at') <> 'null' THEN
      RAISE EXCEPTION 'This run is locked (%). Its content cannot be changed and retries are refused.', coalesce(o->>'lock_reason','locked') USING ERRCODE = 'P0001';
    END IF;
    IF public.bg_output_field(TG_TABLE_NAME, k, true) AND jsonb_typeof(o->k) <> 'null'
       AND (jsonb_typeof(n->k) = 'null' OR NOT streaming) THEN
      SELECT coalesce(max(version_no),0)+1 INTO vno FROM public.run_output_versions
        WHERE run_table = TG_TABLE_NAME AND run_id = OLD.id AND field = k;
      INSERT INTO public.run_output_versions(run_table, run_id, field, version_no, content, reason, created_by)
      VALUES (TG_TABLE_NAME, OLD.id, k, vno, o->k,
        coalesce(reason, CASE WHEN jsonb_typeof(n->k) = 'null' THEN 'cleared' ELSE 'overwritten' END), actor);
    END IF;
  END LOOP;
  IF jsonb_typeof(n->'version_reason') <> 'null' OR jsonb_typeof(n->'version_actor') <> 'null' THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object('version_reason', NULL, 'version_actor', NULL));
  END IF;
  IF TG_TABLE_NAME = 'sessions' AND jsonb_typeof(o->'locked_at') = 'null' THEN
    was_done := o->>'status' = 'complete' AND (o->>'phase_2_status' = 'complete' OR coalesce((o->>'strategy_signoff_stop')::boolean,false));
    now_done := n->>'status' = 'complete' AND (n->>'phase_2_status' = 'complete' OR coalesce((n->>'strategy_signoff_stop')::boolean,false));
    IF now_done AND NOT was_done THEN
      NEW := jsonb_populate_record(NEW, jsonb_build_object('locked_at', now(), 'lock_reason', 'Run completed'));
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.bg_version_and_lock() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER bg_version_and_lock BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.bg_version_and_lock();
CREATE TRIGGER bg_version_and_lock BEFORE UPDATE ON public.briefing_room_workspaces FOR EACH ROW EXECUTE FUNCTION public.bg_version_and_lock();