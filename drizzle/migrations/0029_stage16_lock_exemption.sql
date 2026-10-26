CREATE TABLE public.run_lock_exemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  scope text NOT NULL CHECK (scope = 'stage_16_documents'),
  opened_by uuid NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  open_reason text NOT NULL,
  closed_at timestamptz,
  close_reason text
);
CREATE UNIQUE INDEX run_lock_exemptions_one_open ON public.run_lock_exemptions(run_id) WHERE closed_at IS NULL;
GRANT ALL ON public.run_lock_exemptions TO service_role;
GRANT SELECT ON public.run_lock_exemptions TO authenticated;
ALTER TABLE public.run_lock_exemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read lock exemptions" ON public.run_lock_exemptions FOR SELECT TO authenticated USING (public.bg_is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.bg_version_and_lock()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  n jsonb := to_jsonb(NEW); o jsonb := to_jsonb(OLD); k text;
  app boolean := current_user IN ('authenticated','anon');
  streaming boolean := false; reason text; actor uuid; vno integer;
  was_done boolean; now_done boolean; diag_done boolean;
  exempt uuid; allowed jsonb := '{}'::jsonb;
BEGIN
  -- Stage 16-only exemption on a locked run: every change outside Stage 16
  -- document columns is reverted to the stored value; closes itself when all
  -- five documents are saved or a real Stage 16 error is written.
  IF TG_TABLE_NAME = 'sessions' AND jsonb_typeof(o->'locked_at') <> 'null' AND NOT app THEN
    SELECT id INTO exempt FROM public.run_lock_exemptions
      WHERE run_id = OLD.id AND scope = 'stage_16_documents' AND closed_at IS NULL;
    IF exempt IS NOT NULL THEN
      FOR k IN SELECT unnest(ARRAY['stage_16_vision_output','stage_16_consulting_output','stage_16_agency_output',
                                   'stage_16_workshop_output','stage_16_valuation_output','stage_16_error','stage_16_format','updated_at']) LOOP
        allowed := allowed || jsonb_build_object(k, n->k);
      END LOOP;
      NEW := jsonb_populate_record(OLD, allowed);
      n := to_jsonb(NEW);
    END IF;
  END IF;
  IF exempt IS NULL AND ((n->'locked_at') IS DISTINCT FROM (o->'locked_at') OR (n->'locked_by') IS DISTINCT FROM (o->'locked_by')
     OR (n->'lock_reason') IS DISTINCT FROM (o->'lock_reason')) THEN
    IF app THEN RAISE EXCEPTION 'Only an admin can lock a run.' USING ERRCODE = '42501'; END IF;
    IF jsonb_typeof(o->'locked_at') <> 'null' THEN RAISE EXCEPTION 'This run is locked and cannot be unlocked.' USING ERRCODE = 'P0001'; END IF;
  END IF;
  IF TG_TABLE_NAME = 'sessions' THEN
    streaming := coalesce(o->>'stage_status','') LIKE 'running%';
    IF (n->'run_mode') IS DISTINCT FROM (o->'run_mode') AND jsonb_typeof(o->'stage_1_output') <> 'null' THEN
      RAISE EXCEPTION 'Run type cannot change once Stage 1 has run.' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  reason := nullif(n->>'version_reason',''); actor := coalesce(auth.uid(), nullif(n->>'version_actor','')::uuid);
  FOR k IN SELECT jsonb_object_keys(o) LOOP
    CONTINUE WHEN NOT public.bg_output_field(TG_TABLE_NAME, k, false);
    CONTINUE WHEN (n->k) IS NOT DISTINCT FROM (o->k);
    IF jsonb_typeof(o->'locked_at') <> 'null' AND exempt IS NULL THEN
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
  IF exempt IS NOT NULL THEN
    IF coalesce(n->>'stage_16_error','') <> '' AND n->>'stage_16_error' NOT LIKE '\_\_STAGE\_16\_RUNNING\_\_%' THEN
      UPDATE public.run_lock_exemptions SET closed_at = now(), close_reason = 'Re-locked after failure: ' || left(n->>'stage_16_error', 500) WHERE id = exempt;
    ELSIF jsonb_typeof(n->'stage_16_error') = 'null'
      AND coalesce(n->>'stage_16_vision_output','') <> '' AND coalesce(n->>'stage_16_consulting_output','') <> ''
      AND coalesce(n->>'stage_16_agency_output','') <> '' AND coalesce(n->>'stage_16_workshop_output','') <> ''
      AND coalesce(n->>'stage_16_valuation_output','') <> '' THEN
      UPDATE public.run_lock_exemptions SET closed_at = now(), close_reason = 'Re-locked: all five Stage 16 documents saved' WHERE id = exempt;
    END IF;
    RETURN NEW;
  END IF;
  IF jsonb_typeof(n->'version_reason') <> 'null' OR jsonb_typeof(n->'version_actor') <> 'null' THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object('version_reason', NULL, 'version_actor', NULL));
  END IF;
  IF TG_TABLE_NAME = 'sessions' AND jsonb_typeof(o->'locked_at') = 'null' THEN
    IF n->>'run_mode' = 'diagnostic' THEN
      IF coalesce(n->>'stage_13_output','') <> '' AND coalesce(n->>'stage_status','') NOT LIKE 'running%' THEN
        diag_done := public.bg_diagnostic_complete(n);
        NEW := jsonb_populate_record(NEW, jsonb_build_object(
          'diagnostic_status', CASE WHEN diag_done THEN 'complete' ELSE 'partial' END,
          'status', 'complete', 'locked_at', now(),
          'lock_reason', CASE WHEN diag_done THEN 'Diagnostic run completed' ELSE 'Diagnostic run finished (partial)' END));
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