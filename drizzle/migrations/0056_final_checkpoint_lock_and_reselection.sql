CREATE OR REPLACE FUNCTION public.bg_version_and_lock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  n jsonb := to_jsonb(NEW); o jsonb := to_jsonb(OLD); k text;
  app boolean := current_user IN ('authenticated','anon');
  streaming boolean := false; reason text; actor uuid; vno integer;
  was_done boolean; now_done boolean; diag_done boolean;
  locked boolean := jsonb_typeof(o->'locked_at') <> 'null';
  s16 jsonb := '{"stage_16_agency_output":"agency","stage_16_consulting_output":"consulting","stage_16_workshop_output":"workshop","stage_16_vision_output":"vision","stage_16_valuation_output":"valuation"}';
  fmt text; done_set text[]; g record; grant_used boolean := false;
BEGIN
  IF (n->'locked_at') IS DISTINCT FROM (o->'locked_at') OR (n->'locked_by') IS DISTINCT FROM (o->'locked_by')
     OR (n->'lock_reason') IS DISTINCT FROM (o->'lock_reason') THEN
    IF app THEN RAISE EXCEPTION 'Only an admin can lock a run.' USING ERRCODE = '42501'; END IF;
    IF locked THEN RAISE EXCEPTION 'This run is locked and cannot be unlocked.' USING ERRCODE = 'P0001'; END IF;
  END IF;
  IF TG_TABLE_NAME = 'sessions' THEN
    streaming := coalesce(o->>'stage_status','') LIKE 'running%';
    IF (n->'run_mode') IS DISTINCT FROM (o->'run_mode') AND jsonb_typeof(o->'stage_1_output') <> 'null' THEN
      RAISE EXCEPTION 'Run type cannot change once Stage 1 has run.' USING ERRCODE = 'P0001';
    END IF;
    done_set := coalesce(OLD.stage_16_completed_formats, '{}');
    IF locked AND NEW.stage_16_completed_formats IS DISTINCT FROM OLD.stage_16_completed_formats THEN
      NEW.stage_16_completed_formats := OLD.stage_16_completed_formats;
      n := to_jsonb(NEW);
    END IF;
  END IF;
  reason := nullif(n->>'version_reason',''); actor := coalesce(auth.uid(), nullif(n->>'version_actor','')::uuid);
  FOR k IN SELECT jsonb_object_keys(o) LOOP
    CONTINUE WHEN NOT public.bg_output_field(TG_TABLE_NAME, k, false);
    CONTINUE WHEN (n->k) IS NOT DISTINCT FROM (o->k);
    IF locked THEN
      fmt := CASE WHEN TG_TABLE_NAME = 'sessions' THEN s16->>k END;
      IF fmt IS NULL THEN
        RAISE EXCEPTION 'This run is locked (%). Its content cannot be changed and retries are refused.', coalesce(o->>'lock_reason','locked') USING ERRCODE = 'P0001';
      END IF;
      IF fmt = ANY(done_set) THEN
        SELECT * INTO g FROM public.run_lock_exemptions
          WHERE run_id = OLD.id AND scope = 'stage_16_regenerate' AND format = fmt AND closed_at IS NULL;
        IF g.id IS NULL THEN
          RAISE EXCEPTION 'This run is locked. Its % Stage 16 document is already saved; regenerating it is admin-only and needs a reason.', fmt USING ERRCODE = 'P0001';
        END IF;
        grant_used := true;
        reason := coalesce(reason, 'Admin regeneration on locked run: ' || g.open_reason);
        actor := coalesce(actor, g.opened_by);
        CONTINUE WHEN EXISTS (SELECT 1 FROM public.run_output_versions
          WHERE run_table = TG_TABLE_NAME AND run_id = OLD.id AND field = k AND created_at >= g.opened_at);
      ELSE
        CONTINUE;
      END IF;
    END IF;
    IF public.bg_output_field(TG_TABLE_NAME, k, true) AND jsonb_typeof(o->k) <> 'null'
       AND (jsonb_typeof(n->k) = 'null' OR NOT streaming OR grant_used) THEN
      SELECT coalesce(max(version_no),0)+1 INTO vno FROM public.run_output_versions
        WHERE run_table = TG_TABLE_NAME AND run_id = OLD.id AND field = k;
      INSERT INTO public.run_output_versions(run_table, run_id, field, version_no, content, reason, created_by)
      VALUES (TG_TABLE_NAME, OLD.id, k, vno, o->k,
        coalesce(reason, CASE WHEN jsonb_typeof(n->k) = 'null' THEN 'cleared' ELSE 'overwritten' END), actor);
    END IF;
  END LOOP;
  IF TG_TABLE_NAME = 'sessions' THEN
    IF n->>'stage_status' = 'complete:16' THEN
      FOR k IN SELECT jsonb_object_keys(s16) LOOP
        fmt := s16->>k;
        IF (n->k) IS DISTINCT FROM (o->k) AND length(coalesce(n->>k,'')) > 0 THEN
          IF NOT fmt = ANY(NEW.stage_16_completed_formats) THEN
            NEW.stage_16_completed_formats := NEW.stage_16_completed_formats || fmt;
          END IF;
          UPDATE public.run_lock_exemptions SET closed_at = now(), close_reason = 'Regenerated document saved'
            WHERE run_id = OLD.id AND scope = 'stage_16_regenerate' AND format = fmt AND closed_at IS NULL;
        END IF;
      END LOOP;
    ELSIF coalesce(n->>'stage_16_error','') <> '' AND n->>'stage_16_error' NOT LIKE '\_\_STAGE\_16\_RUNNING\_\_%'
          AND (n->'stage_16_error') IS DISTINCT FROM (o->'stage_16_error') THEN
      UPDATE public.run_lock_exemptions SET closed_at = now(), close_reason = 'Closed after failure: ' || left(n->>'stage_16_error', 500)
        WHERE run_id = OLD.id AND scope = 'stage_16_regenerate' AND closed_at IS NULL;
    END IF;
    IF locked THEN
      NEW.status := OLD.status; NEW.current_stage := OLD.current_stage; NEW.stage_status := OLD.stage_status;
    END IF;
    n := to_jsonb(NEW);
  END IF;
  IF jsonb_typeof(n->'version_reason') <> 'null' OR jsonb_typeof(n->'version_actor') <> 'null' THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object('version_reason', NULL, 'version_actor', NULL));
  END IF;
  IF TG_TABLE_NAME = 'sessions' AND NOT locked THEN
    IF n->>'run_mode' = 'diagnostic' THEN
      IF coalesce(n->>'stage_13_output','') <> '' AND coalesce(n->>'stage_status','') NOT LIKE 'running%' THEN
        diag_done := public.bg_diagnostic_complete(n);
        -- Validate runs keep their completion lock. Every other diagnostic run
        -- (plain Diagnostic, Headroom, Turnaround) locks only at its final
        -- checkpoint: the recorded sign-off. Until then the selection can change.
        IF jsonb_typeof(n->'validate_brief') <> 'null' THEN
          NEW := jsonb_populate_record(NEW, jsonb_build_object(
            'diagnostic_status', CASE WHEN diag_done THEN 'complete' ELSE 'partial' END,
            'status', 'complete', 'locked_at', now(),
            'lock_reason', CASE WHEN diag_done THEN 'Diagnostic run completed' ELSE 'Diagnostic run finished (partial)' END));
        ELSIF coalesce((n->>'strategy_signoff_confirmed')::boolean, false) THEN
          NEW := jsonb_populate_record(NEW, jsonb_build_object(
            'diagnostic_status', CASE WHEN diag_done THEN 'complete' ELSE 'partial' END,
            'status', 'complete', 'locked_at', now(),
            'lock_reason', CASE WHEN diag_done THEN 'Final checkpoint signed off' ELSE 'Final checkpoint signed off (partial)' END));
        ELSE
          NEW := jsonb_populate_record(NEW, jsonb_build_object(
            'diagnostic_status', CASE WHEN diag_done THEN 'complete' ELSE 'partial' END,
            'status', 'complete'));
        END IF;
      ELSE
        NEW := jsonb_populate_record(NEW, jsonb_build_object('diagnostic_status', 'in_progress'));
      END IF;
    ELSE
      was_done := o->>'phase_2_status' = 'complete' OR (o->>'status' = 'complete' AND coalesce((o->>'strategy_signoff_stop')::boolean,false));
      now_done := n->>'phase_2_status' = 'complete' OR (n->>'status' = 'complete' AND coalesce((n->>'strategy_signoff_stop')::boolean,false));
      IF now_done AND NOT was_done THEN
        NEW := jsonb_populate_record(NEW, jsonb_build_object('locked_at', now(), 'lock_reason', 'Run completed'));
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $function$;

CREATE TABLE public.selection_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  version_no integer NOT NULL,
  selected_smp text,
  selected_smp_field_name text,
  selection_source text,
  selection_engine text,
  selected_loc_expression text,
  selection_rationale jsonb,
  checkpoint_c_confirmed_at timestamptz,
  stage_13_verdict text,
  stage_13_output text,
  superseded_at timestamptz NOT NULL DEFAULT now(),
  superseded_by uuid,
  reason text NOT NULL,
  UNIQUE (session_id, version_no)
);
CREATE INDEX selection_versions_session_idx ON public.selection_versions (session_id, version_no);
GRANT SELECT ON public.selection_versions TO authenticated;
GRANT ALL ON public.selection_versions TO service_role;
ALTER TABLE public.selection_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Run collaborators read selection history" ON public.selection_versions
  FOR SELECT TO authenticated USING (public.can_access_session(session_id, auth.uid()) OR public.bg_is_admin(auth.uid()));
COMMENT ON TABLE public.selection_versions IS 'Append-only: every earlier confirmed Stage 12 selection and its Stage 13 verdict, written only by bg_reselect_proposition.';

CREATE OR REPLACE FUNCTION public.bg_selection_versions_append_only()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN RAISE EXCEPTION 'Selection history is append-only.' USING ERRCODE = 'P0001'; END $$;
CREATE TRIGGER selection_versions_append_only BEFORE UPDATE OR DELETE ON public.selection_versions
  FOR EACH ROW EXECUTE FUNCTION public.bg_selection_versions_append_only();

CREATE OR REPLACE FUNCTION public.bg_reselect_proposition(
  p_session_id uuid, p_smp text, p_field text, p_loc_expression text, p_source text, p_engine text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); s public.sessions%ROWTYPE; vno integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in to change the selection.' USING ERRCODE = '42501'; END IF;
  IF coalesce(trim(p_smp),'') = '' OR coalesce(trim(p_field),'') = '' THEN RAISE EXCEPTION 'Choose a proposition first.' USING ERRCODE = 'P0001'; END IF;
  IF p_source NOT IN ('CORE','LOC') THEN RAISE EXCEPTION 'Choose one proposition.' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO s FROM public.sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_access_session(p_session_id, uid) THEN RAISE EXCEPTION 'Run not found.' USING ERRCODE = '42501'; END IF;
  IF s.locked_at IS NOT NULL THEN RAISE EXCEPTION 'RESELECT_LOCKED: This run is locked, so its selection cannot change.' USING ERRCODE = 'P0001'; END IF;
  IF s.validate_brief IS NOT NULL THEN RAISE EXCEPTION 'RESELECT_VALIDATE: Validate runs keep comparators only; there is no selection to change.' USING ERRCODE = 'P0001'; END IF;
  IF coalesce(s.strategy_signoff_confirmed, false) THEN RAISE EXCEPTION 'RESELECT_SIGNED_OFF: The final checkpoint has been signed off, so the selection cannot change.' USING ERRCODE = 'P0001'; END IF;
  IF NOT coalesce(s.checkpoint_c_confirmed, false) OR coalesce(s.selected_smp,'') = '' THEN RAISE EXCEPTION 'RESELECT_NOTHING_CONFIRMED: No confirmed selection yet — choose at Stage 12.' USING ERRCODE = 'P0001'; END IF;
  IF coalesce(s.stage_status,'') LIKE 'running%' THEN RAISE EXCEPTION 'RESELECT_BUSY: A stage is still running; wait for it to finish.' USING ERRCODE = 'P0001'; END IF;
  SELECT coalesce(max(version_no),0)+1 INTO vno FROM public.selection_versions WHERE session_id = p_session_id;
  INSERT INTO public.selection_versions(session_id, version_no, selected_smp, selected_smp_field_name, selection_source, selection_engine,
    selected_loc_expression, selection_rationale, checkpoint_c_confirmed_at, stage_13_verdict, stage_13_output, superseded_by, reason)
  VALUES (p_session_id, vno, s.selected_smp, s.selected_smp_field_name, s.selection_source, s.selection_engine,
    s.selected_loc_expression, s.selection_rationale, s.checkpoint_c_confirmed_at, s.stage_13_verdict, s.stage_13_output, uid,
    'Reselected at Stage 12');
  UPDATE public.sessions SET
    selected_smp = p_smp, selected_smp_field_name = p_field, selected_loc_expression = p_loc_expression,
    selection_source = p_source, selection_engine = p_engine,
    selection_rationale = NULL, checkpoint_c_confirmed = false, checkpoint_c_confirmed_at = NULL, checkpoint_c_notes = NULL,
    stage_13_output = NULL, stage_13_error = NULL, stage_13_structured = NULL, stage_13_structured_error = NULL, stage_13_verdict = NULL,
    stage_13b_output = NULL, stage_13b_error = NULL,
    status = 'running', current_stage = 12, stage_status = 'complete:12',
    version_reason = 'Reselection: earlier selection kept as selection version ' || vno, version_actor = uid
  WHERE id = p_session_id;
  RETURN vno;
END $$;
REVOKE ALL ON FUNCTION public.bg_reselect_proposition(uuid,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bg_reselect_proposition(uuid,text,text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.bg_confirm_checkpoint_c(p_session_id uuid, p_rationale jsonb, p_output text)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); s public.sessions%ROWTYPE; at timestamptz := now();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in to confirm.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO s FROM public.sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_access_session(p_session_id, uid) THEN RAISE EXCEPTION 'Run not found.' USING ERRCODE = '42501'; END IF;
  IF coalesce(s.selected_smp,'') = '' THEN RAISE EXCEPTION 'Select a proposition before confirming its rationale' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.sessions SET selection_rationale = p_rationale, stage_12_output = p_output,
    version_reason = 'Checkpoint C: saved human selection rationale', version_actor = uid,
    checkpoint_c_confirmed = true, checkpoint_c_confirmed_at = at
  WHERE id = p_session_id;
  INSERT INTO public.checkpoint_confirmations(session_id, checkpoint, confirmed_by, confirmed_at, selected_smp)
  VALUES (p_session_id, 'c', uid, at, s.selected_smp);
  RETURN at;
END $$;
REVOKE ALL ON FUNCTION public.bg_confirm_checkpoint_c(uuid,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bg_confirm_checkpoint_c(uuid,jsonb,text) TO authenticated;

ALTER TABLE public.sessions DISABLE TRIGGER bg_version_and_lock;
UPDATE public.sessions SET locked_at = NULL, locked_by = NULL, lock_reason = NULL
 WHERE id = '06134f96-23c8-43cb-9b5d-5fcfc609964f' AND lock_reason = 'Diagnostic run completed'
   AND NOT coalesce(strategy_signoff_confirmed, false);
ALTER TABLE public.sessions ENABLE TRIGGER bg_version_and_lock;