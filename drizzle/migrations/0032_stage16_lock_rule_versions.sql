CREATE OR REPLACE FUNCTION public.bg_version_and_lock()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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