ALTER TABLE public.bg_exploration_jobs
  ADD COLUMN generation integer NOT NULL DEFAULT 1;

ALTER TABLE public.bg_exploration_attempts
  ADD COLUMN generation integer NOT NULL DEFAULT 1;
ALTER TABLE public.bg_exploration_attempts
  DROP CONSTRAINT bg_exploration_attempts_job_id_attempt_key;
ALTER TABLE public.bg_exploration_attempts
  ADD CONSTRAINT bg_exploration_attempts_job_generation_attempt_key UNIQUE (job_id, generation, attempt);

ALTER TABLE public.bg_exploration_assessments
  ADD COLUMN selection_confirmed_at timestamptz,
  ADD COLUMN selected_smp text;

CREATE OR REPLACE FUNCTION public.bg_exploration_queue_on_completion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.exploration_brief IS NOT NULL AND NEW.stage_13_output IS NOT NULL AND OLD.stage_13_output IS NULL THEN
    IF NOT (NEW.checkpoint_a_confirmed AND NEW.checkpoint_b_confirmed AND NEW.checkpoint_c_confirmed) THEN
      RAISE EXCEPTION 'EXPLORATION_CHECKPOINT_NOT_CONFIRMED';
    END IF;
    INSERT INTO public.bg_exploration_jobs(session_id) VALUES(NEW.id)
    ON CONFLICT(session_id) DO UPDATE SET
      status = 'queued', generation = public.bg_exploration_jobs.generation + 1,
      lease_token = NULL, lease_until = NULL, error = NULL;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.bg_publish_exploration(_job uuid, _lease uuid, _baseline uuid, _version int, _outputs jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  j public.bg_exploration_jobs;
  s public.sessions;
  r uuid;
BEGIN
  SELECT * INTO j FROM public.bg_exploration_jobs WHERE id = _job FOR UPDATE;
  IF j.status <> 'running' OR j.lease_token IS DISTINCT FROM _lease OR j.lease_until < now() THEN
    RAISE EXCEPTION 'EXPLORATION_LEASE_LOST';
  END IF;
  SELECT * INTO s FROM public.sessions WHERE id = j.session_id;
  INSERT INTO public.bg_exploration_assessments(
    session_id, baseline_job_id, run_version, outputs, selection_confirmed_at, selected_smp
  ) VALUES(
    j.session_id, _baseline, _version, _outputs, s.checkpoint_c_confirmed_at, s.selected_smp
  ) RETURNING id INTO r;
  UPDATE public.bg_exploration_jobs SET status = 'complete', lease_until = NULL, error = NULL WHERE id = j.id;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.bg_publish_exploration(uuid,uuid,uuid,int,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bg_publish_exploration(uuid,uuid,uuid,int,jsonb) TO service_role;

-- Selection fields are part of a run's versioned state, not merely transient
-- change detection. This lets historical Hub reads pair the right confirmed
-- proposition, rationale and Checkpoint C timestamp with that version.
CREATE OR REPLACE FUNCTION public.bg_output_field(_table text, _k text, _versioned boolean)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _table
    WHEN 'sessions' THEN
      (_k ~ '_outputs?$' OR _k ~ '^stage_[0-9a-z]+_structured$' OR _k IN ('stage_12_smps','loc_engine_outputs','loc_decision_packages','loc_validation'))
      OR (_k LIKE 'selected\_%' OR _k IN ('selection_source','selection_engine','selection_rationale','checkpoint_c_confirmed','checkpoint_c_confirmed_at'))
      OR (NOT _versioned AND (_k LIKE 'checkpoint\_%' OR _k LIKE 'locked\_big\_idea%'
          OR _k LIKE 'current\_proposition%' OR _k ~ '^stage_[0-9a-z]+_structured_error$'
          OR _k IN ('locked_campaign_line','brief_text','stage_amendments','brief_versions','run_mode','continues_diagnostic_id')))
    WHEN 'briefing_room_workspaces' THEN
      _k IN ('diagnosis','truths','relevance','tensions')
      OR (NOT _versioned AND _k IN ('raw_brief','supporting_evidence','selected_frame','selected_tension_index','brand_name','category'))
    ELSE false END
$$;