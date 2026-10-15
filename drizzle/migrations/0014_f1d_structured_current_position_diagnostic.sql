ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS stage_9_structured jsonb,
  ADD COLUMN IF NOT EXISTS stage_9_structured_error text,
  ADD COLUMN IF NOT EXISTS stage_10_structured jsonb,
  ADD COLUMN IF NOT EXISTS stage_10_structured_error text,
  ADD COLUMN IF NOT EXISTS stage_11_structured jsonb,
  ADD COLUMN IF NOT EXISTS stage_11_structured_error text,
  ADD COLUMN IF NOT EXISTS stage_13_structured jsonb,
  ADD COLUMN IF NOT EXISTS stage_13_structured_error text,
  ADD COLUMN IF NOT EXISTS run_mode text NOT NULL DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS diagnostic_status text,
  ADD COLUMN IF NOT EXISTS current_proposition text,
  ADD COLUMN IF NOT EXISTS current_proposition_source text,
  ADD COLUMN IF NOT EXISTS current_proposition_date date,
  ADD COLUMN IF NOT EXISTS continues_diagnostic_id uuid REFERENCES public.sessions(id);

ALTER TABLE public.sessions ADD CONSTRAINT sessions_run_mode_check CHECK (run_mode IN ('full','diagnostic'));
ALTER TABLE public.sessions ADD CONSTRAINT sessions_diagnostic_status_check CHECK (
  (run_mode = 'full' AND diagnostic_status IS NULL)
  OR (run_mode = 'diagnostic' AND diagnostic_status IN ('in_progress','partial','complete')));

COMMENT ON COLUMN public.sessions.run_mode IS 'full | diagnostic. Chosen at start; immutable once Stage 1 has output.';
COMMENT ON COLUMN public.sessions.diagnostic_status IS 'Diagnostic runs only; set by bg_version_and_lock. partial = a required output (Stages 2, 9, 10, 11, 13, scored current position) is missing.';
COMMENT ON COLUMN public.sessions.continues_diagnostic_id IS 'Full run started from this locked diagnostic run (the diagnostic is never altered).';
COMMENT ON COLUMN public.sessions.stage_10_structured IS 'Validated structured Stage 10 record; includes current_position (scored in the same call, kept out of selection).';

CREATE OR REPLACE FUNCTION public.bg_output_field(_table text, _k text, _versioned boolean) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _table
    WHEN 'sessions' THEN
      (_k ~ '_outputs?$' OR _k ~ '^stage_[0-9a-z]+_structured$' OR _k IN ('stage_12_smps','loc_engine_outputs','loc_decision_packages','loc_validation'))
      OR (NOT _versioned AND (_k LIKE 'selected\_%' OR _k LIKE 'checkpoint\_%' OR _k LIKE 'locked\_big\_idea%'
          OR _k LIKE 'current\_proposition%' OR _k ~ '^stage_[0-9a-z]+_structured_error$'
          OR _k IN ('locked_campaign_line','brief_text','stage_amendments','brief_versions','selection_rationale','run_mode','continues_diagnostic_id')))
    WHEN 'briefing_room_workspaces' THEN
      _k IN ('diagnosis','truths','relevance','tensions')
      OR (NOT _versioned AND _k IN ('raw_brief','supporting_evidence','selected_frame','selected_tension_index','brand_name','category'))
    ELSE false END
$$;

CREATE OR REPLACE FUNCTION public.bg_diagnostic_complete(n jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT coalesce(n->>'stage_2_output','') <> '' AND coalesce(n->>'stage_9_output','') <> ''
     AND coalesce(n->>'stage_10_output','') <> '' AND coalesce(n->>'stage_11_output','') <> ''
     AND coalesce(n->>'stage_13_output','') <> ''
     AND (n->'stage_10_structured'->'current_position'->>'status') = 'scored'
$$;

CREATE OR REPLACE FUNCTION public.bg_version_and_lock() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n jsonb := to_jsonb(NEW); o jsonb := to_jsonb(OLD); k text;
  app boolean := current_user IN ('authenticated','anon');
  streaming boolean := false; reason text; actor uuid; vno integer;
  was_done boolean; now_done boolean; diag_done boolean;
BEGIN
  IF (n->'locked_at') IS DISTINCT FROM (o->'locked_at') OR (n->'locked_by') IS DISTINCT FROM (o->'locked_by')
     OR (n->'lock_reason') IS DISTINCT FROM (o->'lock_reason') THEN
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
    IF n->>'run_mode' = 'diagnostic' THEN
      -- Diagnostic: stops after Stage 13; finishing Stage 13 marks it complete or partial and locks it.
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
END $$;
REVOKE ALL ON FUNCTION public.bg_version_and_lock() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bg_diagnostic_complete(jsonb) FROM PUBLIC, anon;