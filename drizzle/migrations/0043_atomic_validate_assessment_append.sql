CREATE FUNCTION public.bg_append_validate_assessment(_session uuid,_version integer,_actor uuid,_baseline uuid,_brand text,_brief jsonb,_outputs jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.sessions; j public.current_position_addon_jobs; v integer; revision integer; result uuid; output_id text;
BEGIN
 SELECT * INTO s FROM public.sessions WHERE id=_session FOR UPDATE;
 IF s.id IS NULL OR NOT (public.can_access_session(_session,_actor) OR public.bg_is_admin(_actor)) THEN RAISE EXCEPTION 'VALIDATE_SOURCE_ACCESS_DENIED'; END IF;
 IF s.locked_at IS NULL THEN RAISE EXCEPTION 'VALIDATE_SOURCE_NOT_LOCKED'; END IF;
 SELECT count(DISTINCT created_at)+1 INTO v FROM public.run_output_versions WHERE run_table='sessions' AND run_id=_session;
 IF _version < 1 OR _version > v THEN RAISE EXCEPTION 'VALIDATE_SOURCE_VERSION_NOT_FOUND'; END IF;
 SELECT * INTO j FROM public.current_position_addon_jobs WHERE id=_baseline;
 IF j.id IS NULL OR j.session_id<>_session OR j.status<>'complete' OR j.published_version>_version OR lower(btrim(j.source_manifest->>'subject_brand')) IS DISTINCT FROM lower(btrim(_brand)) THEN RAISE EXCEPTION 'VALIDATE_SAME_BRAND_BASELINE_NOT_AVAILABLE'; END IF;
 IF _brief->>'currentProposition' IS DISTINCT FROM j.proposition THEN RAISE EXCEPTION 'VALIDATE_PROPOSITION_CHANGED'; END IF;
 FOREACH output_id IN ARRAY ARRAY['validate.verdict','validate.current_position','validate.pressure_tests','validate.evidence_gaps'] LOOP
 IF _outputs->output_id->>'mode' IS DISTINCT FROM 'validate' OR _outputs->output_id->>'run_id' IS DISTINCT FROM _session::text OR (_outputs->output_id->>'run_version')::integer IS DISTINCT FROM _version THEN RAISE EXCEPTION 'VALIDATE_OUTPUT_CONTRACT_FAILED: %',output_id; END IF;
 END LOOP;
 SELECT coalesce(max(assessment_revision),0)+1 INTO revision FROM public.validate_assessments WHERE session_id=_session AND run_version=_version;
 INSERT INTO public.validate_assessments(session_id,run_version,assessment_revision,subject_brand,entry_path,brief,source_kind,source_baseline_job,source_fingerprint,outputs,actor_id) VALUES(_session,_version,revision,_brand,'addon',_brief,CASE WHEN j.source_manifest->>'derivation_label'='Client-supplied' THEN 'client' WHEN j.source_manifest->>'derivation_label'='BG-derived' THEN 'BG-derived' ELSE 'unverified' END,j.id,md5(to_jsonb(s)::text),_outputs,_actor) RETURNING id INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.bg_append_validate_assessment(uuid,integer,uuid,uuid,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bg_append_validate_assessment(uuid,integer,uuid,uuid,text,jsonb,jsonb) TO service_role;