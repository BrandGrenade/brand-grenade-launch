ALTER TABLE public.sessions ADD COLUMN validate_brief jsonb;
ALTER TABLE public.sessions ADD CONSTRAINT sessions_validate_brief_shape CHECK (validate_brief IS NULL OR (run_mode='diagnostic' AND brief_type='campaign' AND jsonb_typeof(validate_brief)='object' AND current_proposition IS NOT NULL AND validate_brief->>'currentProposition'=current_proposition));
COMMENT ON COLUMN public.sessions.validate_brief IS 'Validate mode brief, fixed at insert. Non-null means Validate (Diagnostic path; generated propositions are comparators only).';
CREATE OR REPLACE FUNCTION public.bg_validate_brief_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF OLD.validate_brief IS DISTINCT FROM NEW.validate_brief THEN RAISE EXCEPTION 'VALIDATE_MODE_IMMUTABLE: mode and Validate details are fixed once a run starts'; END IF;
 IF OLD.validate_brief IS NOT NULL AND (OLD.current_proposition IS DISTINCT FROM NEW.current_proposition OR OLD.run_mode IS DISTINCT FROM NEW.run_mode OR OLD.brief_type IS DISTINCT FROM NEW.brief_type) THEN RAISE EXCEPTION 'VALIDATE_MODE_IMMUTABLE: mode and Validate details are fixed once a run starts'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.bg_validate_brief_immutable() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bg_validate_brief_immutable BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.bg_validate_brief_immutable();

ALTER TABLE public.current_position_addon_jobs ADD COLUMN entry_path text NOT NULL DEFAULT 'addon' CHECK (entry_path IN ('addon','new'));
ALTER TABLE public.current_position_addon_jobs DROP CONSTRAINT current_position_addon_jobs_session_id_source_version_key;
CREATE UNIQUE INDEX current_position_addon_jobs_session_version_brand_key ON public.current_position_addon_jobs (session_id, source_version, lower(btrim(source_manifest->>'subject_brand')));

CREATE OR REPLACE FUNCTION public.bg_queue_current_position_addon(_session uuid,_version integer,_actor uuid,_proposition text,_manifest jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.sessions; v integer; j uuid;
BEGIN
 SELECT * INTO s FROM public.sessions WHERE id=_session FOR UPDATE;
 IF s.id IS NULL OR NOT public.bg_is_admin(_actor) OR NOT public.can_access_session(_session,_actor) THEN RAISE EXCEPTION 'BASELINE_ACCESS_DENIED'; END IF;
 SELECT count(DISTINCT created_at)+1 INTO v FROM public.run_output_versions WHERE run_table='sessions' AND run_id=_session;
 IF v<>_version THEN RAISE EXCEPTION 'BASELINE_SOURCE_VERSION_CHANGED'; END IF;
 IF s.brief_type<>'campaign' OR s.locked_at IS NULL THEN RAISE EXCEPTION 'BASELINE_RUN_NOT_ELIGIBLE'; END IF;
 IF coalesce(length(btrim(_proposition)),0)=0 OR coalesce(_manifest->>'derivation_label','') NOT IN ('BG-derived','Client-supplied') OR coalesce(length(btrim(_manifest->>'subject_brand')),0)=0 THEN RAISE EXCEPTION 'BASELINE_PROPOSITION_EVIDENCE_INSUFFICIENT'; END IF;
 INSERT INTO public.current_position_addon_jobs(session_id,source_version,actor_id,proposition,source_manifest,source_fingerprint,entry_path)
 VALUES(_session,_version,_actor,_proposition,_manifest,md5(to_jsonb(s)::text),'addon') ON CONFLICT DO NOTHING RETURNING id INTO j;
 IF j IS NULL THEN SELECT id INTO j FROM public.current_position_addon_jobs WHERE session_id=_session AND source_version=_version AND lower(btrim(source_manifest->>'subject_brand'))=lower(btrim(_manifest->>'subject_brand')); END IF;
 RETURN j;
END $$;

CREATE OR REPLACE FUNCTION public.bg_publish_current_position_addon(_job uuid,_lease uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j public.current_position_addon_jobs; s public.sessions; v integer; n text;
BEGIN
 SELECT * INTO j FROM public.current_position_addon_jobs WHERE id=_job FOR UPDATE;
 IF j.id IS NULL THEN RAISE EXCEPTION 'BASELINE_JOB_NOT_FOUND'; END IF;
 IF j.status='complete' THEN RETURN j.published_version; END IF;
 IF j.status<>'running' OR j.lease_token IS DISTINCT FROM _lease OR j.lease_until<now() THEN RAISE EXCEPTION 'BASELINE_LEASE_LOST'; END IF;
 SELECT * INTO s FROM public.sessions WHERE id=j.session_id FOR UPDATE;
 SELECT count(DISTINCT created_at)+1 INTO v FROM public.run_output_versions WHERE run_table='sessions' AND run_id=j.session_id;
 IF v<>j.source_version OR md5(to_jsonb(s)::text)<>j.source_fingerprint THEN RAISE EXCEPTION 'BASELINE_SOURCE_VERSION_CHANGED'; END IF;
 FOREACH n IN ARRAY ARRAY['10','11','13'] LOOP
 IF NOT(n=ANY(j.completed_stages)) OR j.results->n->>'status'<>'scored' OR j.results->n->>'line'<>j.proposition OR j.results->n->>'derivation_label' IS DISTINCT FROM j.source_manifest->>'derivation_label' OR j.results->n->>'is_current'<>'true' OR j.results->n->>'excluded_from_selection'<>'true' THEN RAISE EXCEPTION 'BASELINE_RESULT_CONTRACT_FAILED: %',n; END IF;
 END LOOP;
 INSERT INTO public.run_output_versions(run_table,run_id,field,version_no,content,reason,created_by)
 VALUES('sessions',j.session_id,'__current_position_addon_boundary',v,'null'::jsonb,format('%s %s current-position add-on; original outputs unchanged',j.source_manifest->>'derivation_label',j.source_manifest->>'subject_brand'),j.actor_id);
 UPDATE public.current_position_addon_jobs SET status='complete',published_version=v+1,completed_at=now(),lease_until=NULL,error_code=NULL,error_message=NULL WHERE id=j.id;
 RETURN v+1;
END $$;

-- New Validate runs: refresh the source binding at job start (only before any stage is saved).
CREATE OR REPLACE FUNCTION public.bg_rebind_validate_job(_job uuid,_manifest jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j public.current_position_addon_jobs; s public.sessions; v integer;
BEGIN
 SELECT * INTO j FROM public.current_position_addon_jobs WHERE id=_job FOR UPDATE;
 IF j.id IS NULL OR j.entry_path<>'new' OR coalesce(array_length(j.completed_stages,1),0)>0 OR j.status IN ('complete') THEN RETURN; END IF;
 SELECT * INTO s FROM public.sessions WHERE id=j.session_id FOR SHARE;
 SELECT count(DISTINCT created_at)+1 INTO v FROM public.run_output_versions WHERE run_table='sessions' AND run_id=j.session_id;
 UPDATE public.current_position_addon_jobs SET source_version=v,source_fingerprint=md5(to_jsonb(s)::text),source_manifest=_manifest WHERE id=_job;
END $$;
REVOKE ALL ON FUNCTION public.bg_rebind_validate_job(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bg_rebind_validate_job(uuid,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.bg_validate_autoqueue() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v integer;
BEGIN
 IF OLD.locked_at IS NULL AND NEW.locked_at IS NOT NULL AND NEW.validate_brief IS NOT NULL THEN
  SELECT count(DISTINCT created_at)+1 INTO v FROM public.run_output_versions WHERE run_table='sessions' AND run_id=NEW.id;
  INSERT INTO public.current_position_addon_jobs(session_id,source_version,actor_id,proposition,source_manifest,source_fingerprint,entry_path)
  VALUES(NEW.id,v,coalesce(NEW.locked_by,NEW.user_id),NEW.current_proposition,jsonb_build_object('derivation_label',CASE WHEN NEW.validate_brief->>'derivationLabel'='Client-supplied' THEN 'Client-supplied' ELSE 'BG-derived' END,'subject_brand',NEW.brand_name,'category',NEW.category,'proposition',NEW.current_proposition,'proposition_source',NEW.validate_brief->>'source','proposition_source_date',NEW.validate_brief->>'sourceDate','evidence_pending',true,'entry_path','new'),md5(to_jsonb(NEW)::text),'new') ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.bg_validate_autoqueue() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bg_validate_autoqueue AFTER UPDATE OF locked_at ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.bg_validate_autoqueue();

CREATE OR REPLACE FUNCTION public.bg_append_validate_assessment_v2(_session uuid,_version integer,_actor uuid,_baseline uuid,_brand text,_brief jsonb,_outputs jsonb,_entry text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.sessions; j public.current_position_addon_jobs; v integer; revision integer; result uuid; output_id text; o jsonb; canonical_brand text;
BEGIN
 IF _entry NOT IN ('addon','new') THEN RAISE EXCEPTION 'VALIDATE_ENTRY_PATH_INVALID'; END IF;
 SELECT * INTO s FROM public.sessions WHERE id=_session FOR UPDATE;
 IF s.id IS NULL OR NOT (public.can_access_session(_session,_actor) OR public.bg_is_admin(_actor)) THEN RAISE EXCEPTION 'VALIDATE_SOURCE_ACCESS_DENIED'; END IF;
 IF s.locked_at IS NULL THEN RAISE EXCEPTION 'VALIDATE_SOURCE_NOT_LOCKED'; END IF;
 IF _entry='new' AND (s.validate_brief IS NULL OR s.validate_brief IS DISTINCT FROM _brief) THEN RAISE EXCEPTION 'VALIDATE_NEW_RUN_BRIEF_MISMATCH'; END IF;
 SELECT count(DISTINCT created_at)+1 INTO v FROM public.run_output_versions WHERE run_table='sessions' AND run_id=_session;
 IF _version IS DISTINCT FROM v THEN RAISE EXCEPTION 'VALIDATE_SOURCE_CURRENT_VERSION_REQUIRED'; END IF;
 SELECT * INTO j FROM public.current_position_addon_jobs WHERE id=_baseline FOR SHARE;
 IF j.id IS NULL OR j.session_id IS DISTINCT FROM _session OR j.status IS DISTINCT FROM 'complete' OR j.published_version IS NULL OR j.published_version>_version OR lower(btrim(j.source_manifest->>'subject_brand')) IS DISTINCT FROM lower(btrim(_brand)) THEN RAISE EXCEPTION 'VALIDATE_SAME_BRAND_BASELINE_NOT_AVAILABLE'; END IF;
 canonical_brand:=j.source_manifest->>'subject_brand';
 IF EXISTS(SELECT 1 FROM public.current_position_addon_jobs b WHERE b.session_id=_session AND b.status='complete' AND b.published_version<=_version AND b.published_version>j.published_version AND lower(btrim(b.source_manifest->>'subject_brand'))=lower(btrim(canonical_brand))) THEN RAISE EXCEPTION 'VALIDATE_BASELINE_SUPERSEDED'; END IF;
 IF _brief->>'currentProposition' IS DISTINCT FROM j.proposition THEN RAISE EXCEPTION 'VALIDATE_PROPOSITION_CHANGED'; END IF;
 FOREACH output_id IN ARRAY ARRAY['validate.verdict','validate.current_position','validate.pressure_tests','validate.evidence_gaps'] LOOP
 o:=_outputs->output_id;
 IF jsonb_typeof(o) IS DISTINCT FROM 'object' OR o->>'mode' IS DISTINCT FROM 'validate' OR o->>'run_id' IS DISTINCT FROM _session::text OR (o->>'run_version')::integer IS DISTINCT FROM _version OR jsonb_typeof(o->'data') IS DISTINCT FROM 'object' OR jsonb_typeof(o->'provenance') IS DISTINCT FROM 'array' OR jsonb_typeof(o->'confidence') IS DISTINCT FROM 'object' OR jsonb_typeof(o->'checkpoint_status') IS DISTINCT FROM 'object' OR jsonb_typeof(o->'limitations') IS DISTINCT FROM 'array' OR o->'decision_questions' IS DISTINCT FROM _brief->'decisionQuestions' THEN RAISE EXCEPTION 'VALIDATE_OUTPUT_CONTRACT_FAILED: %',output_id; END IF;
 END LOOP;
 IF _outputs->'validate.current_position'->'data'->>'proposition' IS DISTINCT FROM j.proposition OR _outputs->'validate.current_position'->'data'->'stage10' IS DISTINCT FROM j.results->'10' OR _outputs->'validate.pressure_tests'->'data'->'stage11' IS DISTINCT FROM j.results->'11' OR _outputs->'validate.pressure_tests'->'data'->'stage13' IS DISTINCT FROM j.results->'13' THEN RAISE EXCEPTION 'VALIDATE_BASELINE_OUTPUT_MISMATCH'; END IF;
 SELECT coalesce(max(assessment_revision),0)+1 INTO revision FROM public.validate_assessments WHERE session_id=_session AND run_version=_version;
 INSERT INTO public.validate_assessments(session_id,run_version,assessment_revision,subject_brand,entry_path,brief,source_kind,source_baseline_job,source_fingerprint,outputs,actor_id) VALUES(_session,_version,revision,canonical_brand,_entry,_brief,CASE WHEN j.source_manifest->>'derivation_label'='Client-supplied' THEN 'client' WHEN j.source_manifest->>'derivation_label'='BG-derived' THEN 'BG-derived' ELSE 'unverified' END,j.id,md5(jsonb_build_object('session',to_jsonb(s),'baseline',jsonb_build_object('id',j.id,'version',j.published_version,'proposition',j.proposition,'manifest',j.source_manifest,'results',j.results),'brief',_brief,'outputs',_outputs)::text),_outputs,_actor) RETURNING id INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.bg_append_validate_assessment_v2(uuid,integer,uuid,uuid,text,jsonb,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bg_append_validate_assessment_v2(uuid,integer,uuid,uuid,text,jsonb,jsonb,text) TO service_role;