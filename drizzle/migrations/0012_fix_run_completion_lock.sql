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
    was_done := o->>'phase_2_status' = 'complete' OR (o->>'status' = 'complete' AND coalesce((o->>'strategy_signoff_stop')::boolean,false));
    now_done := n->>'phase_2_status' = 'complete' OR (n->>'status' = 'complete' AND coalesce((n->>'strategy_signoff_stop')::boolean,false));
    IF now_done AND NOT was_done THEN
      NEW := jsonb_populate_record(NEW, jsonb_build_object('locked_at', now(), 'lock_reason', 'Run completed'));
    END IF;
  END IF;
  RETURN NEW;
END $$;