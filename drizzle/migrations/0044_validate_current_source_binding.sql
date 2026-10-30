CREATE OR REPLACE FUNCTION public.bg_append_validate_assessment(_session uuid,_version integer,_actor uuid,_baseline uuid,_brand text,_brief jsonb,_outputs jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.sessions; j public.current_position_addon_jobs; v integer; revision integer; result uuid; output_id text; o jsonb; canonical_brand text;
BEGIN
 SELECT * INTO s FROM public.sessions WHERE id=_session FOR UPDATE;
 IF s.id IS NULL OR NOT (public.can_access_session(_session,_actor) OR public.bg_is_admin(_actor)) THEN RAISE EXCEPTION 'VALIDATE_SOURCE_ACCESS_DENIED'; END IF;
 IF s.locked_at IS NULL THEN RAISE EXCEPTION 'VALIDATE_SOURCE_NOT_LOCKED'; END IF;
 SELECT count(DISTINCT created_at)+1 INTO v FROM public.run_output_versions WHERE run_table='sessions' AND run_id=_session;
 IF _version IS DISTINCT FROM v THEN RAISE EXCEPTION 'VALIDATE_SOURCE_CURRENT_VERSION_REQUIRED'; END IF;
 SELECT * INTO j FROM public.current_position_addon_jobs WHERE id=_baseline FOR SHARE;
 IF j.id IS NULL OR j.session_id IS DISTINCT FROM _session OR j.status IS DISTINCT FROM 'complete' OR j.published_version IS NULL OR j.published_version>_version OR jsonb_typeof(j.source_manifest) IS DISTINCT FROM 'object' OR lower(btrim(j.source_manifest->>'subject_brand')) IS DISTINCT FROM lower(btrim(_brand)) THEN RAISE EXCEPTION 'VALIDATE_SAME_BRAND_BASELINE_NOT_AVAILABLE'; END IF;
 canonical_brand:=j.source_manifest->>'subject_brand';
 IF EXISTS(SELECT 1 FROM public.current_position_addon_jobs b WHERE b.session_id=_session AND b.status='complete' AND b.published_version<=_version AND b.published_version>j.published_version AND lower(btrim(b.source_manifest->>'subject_brand'))=lower(btrim(canonical_brand))) THEN RAISE EXCEPTION 'VALIDATE_BASELINE_SUPERSEDED'; END IF;
 IF _brief->>'currentProposition' IS DISTINCT FROM j.proposition THEN RAISE EXCEPTION 'VALIDATE_PROPOSITION_CHANGED'; END IF;
 FOREACH output_id IN ARRAY ARRAY['validate.verdict','validate.current_position','validate.pressure_tests','validate.evidence_gaps'] LOOP
 o:=_outputs->output_id;
 IF jsonb_typeof(o) IS DISTINCT FROM 'object' OR o->>'mode' IS DISTINCT FROM 'validate' OR o->>'run_id' IS DISTINCT FROM _session::text OR (o->>'run_version')::integer IS DISTINCT FROM _version OR jsonb_typeof(o->'data') IS DISTINCT FROM 'object' OR jsonb_typeof(o->'provenance') IS DISTINCT FROM 'array' OR jsonb_typeof(o->'confidence') IS DISTINCT FROM 'object' OR jsonb_typeof(o->'checkpoint_status') IS DISTINCT FROM 'object' OR jsonb_typeof(o->'limitations') IS DISTINCT FROM 'array' OR o->'decision_questions' IS DISTINCT FROM _brief->'decisionQuestions' THEN RAISE EXCEPTION 'VALIDATE_OUTPUT_CONTRACT_FAILED: %',output_id; END IF;
 END LOOP;
 IF _outputs->'validate.current_position'->'data'->>'proposition' IS DISTINCT FROM j.proposition OR _outputs->'validate.current_position'->'data'->'stage10' IS DISTINCT FROM j.results->'10' OR _outputs->'validate.pressure_tests'->'data'->'stage11' IS DISTINCT FROM j.results->'11' OR _outputs->'validate.pressure_tests'->'data'->'stage13' IS DISTINCT FROM j.results->'13' THEN RAISE EXCEPTION 'VALIDATE_BASELINE_OUTPUT_MISMATCH'; END IF;
 SELECT coalesce(max(assessment_revision),0)+1 INTO revision FROM public.validate_assessments WHERE session_id=_session AND run_version=_version;
 INSERT INTO public.validate_assessments(session_id,run_version,assessment_revision,subject_brand,entry_path,brief,source_kind,source_baseline_job,source_fingerprint,outputs,actor_id) VALUES(_session,_version,revision,canonical_brand,'addon',_brief,CASE WHEN j.source_manifest->>'derivation_label'='Client-supplied' THEN 'client' WHEN j.source_manifest->>'derivation_label'='BG-derived' THEN 'BG-derived' ELSE 'unverified' END,j.id,md5(jsonb_build_object('session',to_jsonb(s),'baseline',jsonb_build_object('id',j.id,'version',j.published_version,'proposition',j.proposition,'manifest',j.source_manifest,'results',j.results),'brief',_brief,'outputs',_outputs)::text),_outputs,_actor) RETURNING id INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.bg_append_validate_assessment(uuid,integer,uuid,uuid,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bg_append_validate_assessment(uuid,integer,uuid,uuid,text,jsonb,jsonb) TO service_role;