ALTER TABLE public.validate_assessments DROP CONSTRAINT validate_assessments_source_kind_check;
ALTER TABLE public.validate_assessments ADD CONSTRAINT validate_assessments_source_kind_check CHECK (source_kind = ANY (ARRAY['client','owner-stated','BG-derived','unverified']));

-- Owner-stated (public) counts only with a cited source, date and quote; otherwise it is BG-derived.
CREATE OR REPLACE FUNCTION public.bg_effective_derivation(_label text,_source text,_date text,_quote text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
 SELECT CASE WHEN _label='Client-supplied' THEN 'Client-supplied'
  WHEN _label='Owner-stated (public)' AND coalesce(btrim(_source),'')<>'' AND coalesce(btrim(_date),'')<>'' AND coalesce(btrim(_quote),'')<>'' THEN 'Owner-stated (public)'
  ELSE 'BG-derived' END $$;

CREATE OR REPLACE FUNCTION public.bg_append_validate_assessment(_session uuid, _version integer, _actor uuid, _baseline uuid, _brand text, _brief jsonb, _outputs jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
 INSERT INTO public.validate_assessments(session_id,run_version,assessment_revision,subject_brand,entry_path,brief,source_kind,source_baseline_job,source_fingerprint,outputs,actor_id) VALUES(_session,_version,revision,canonical_brand,'addon',_brief,CASE WHEN j.source_manifest->>'derivation_label'='Client-supplied' THEN 'client' WHEN j.source_manifest->>'derivation_label'='Owner-stated (public)' AND public.bg_effective_derivation(j.source_manifest->>'derivation_label',j.source_manifest->>'proposition_source',j.source_manifest->>'proposition_source_date',j.source_manifest->>'proposition_source_quote')='Owner-stated (public)' THEN 'owner-stated' WHEN j.source_manifest->>'derivation_label' IN ('BG-derived','Owner-stated (public)') THEN 'BG-derived' ELSE 'unverified' END,j.id,md5(jsonb_build_object('session',to_jsonb(s),'baseline',jsonb_build_object('id',j.id,'version',j.published_version,'proposition',j.proposition,'manifest',j.source_manifest,'results',j.results),'brief',_brief,'outputs',_outputs)::text),_outputs,_actor) RETURNING id INTO result;
 RETURN result;
END $function$;

CREATE OR REPLACE FUNCTION public.bg_append_validate_assessment_v2(_session uuid, _version integer, _actor uuid, _baseline uuid, _brand text, _brief jsonb, _outputs jsonb, _entry text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
 INSERT INTO public.validate_assessments(session_id,run_version,assessment_revision,subject_brand,entry_path,brief,source_kind,source_baseline_job,source_fingerprint,outputs,actor_id) VALUES(_session,_version,revision,canonical_brand,_entry,_brief,CASE WHEN j.source_manifest->>'derivation_label'='Client-supplied' THEN 'client' WHEN j.source_manifest->>'derivation_label'='Owner-stated (public)' AND public.bg_effective_derivation(j.source_manifest->>'derivation_label',j.source_manifest->>'proposition_source',j.source_manifest->>'proposition_source_date',j.source_manifest->>'proposition_source_quote')='Owner-stated (public)' THEN 'owner-stated' WHEN j.source_manifest->>'derivation_label' IN ('BG-derived','Owner-stated (public)') THEN 'BG-derived' ELSE 'unverified' END,j.id,md5(jsonb_build_object('session',to_jsonb(s),'baseline',jsonb_build_object('id',j.id,'version',j.published_version,'proposition',j.proposition,'manifest',j.source_manifest,'results',j.results),'brief',_brief,'outputs',_outputs)::text),_outputs,_actor) RETURNING id INTO result;
 RETURN result;
END $function$;

CREATE OR REPLACE FUNCTION public.bg_queue_current_position_addon(_session uuid, _version integer, _actor uuid, _proposition text, _manifest jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE s public.sessions; v integer; j uuid;
BEGIN
 SELECT * INTO s FROM public.sessions WHERE id=_session FOR UPDATE;
 IF s.id IS NULL OR NOT public.bg_is_admin(_actor) OR NOT public.can_access_session(_session,_actor) THEN RAISE EXCEPTION 'BASELINE_ACCESS_DENIED'; END IF;
 SELECT count(DISTINCT created_at)+1 INTO v FROM public.run_output_versions WHERE run_table='sessions' AND run_id=_session;
 IF v<>_version THEN RAISE EXCEPTION 'BASELINE_SOURCE_VERSION_CHANGED'; END IF;
 IF s.brief_type<>'campaign' OR s.locked_at IS NULL THEN RAISE EXCEPTION 'BASELINE_RUN_NOT_ELIGIBLE'; END IF;
 IF coalesce(length(btrim(_proposition)),0)=0 OR coalesce(_manifest->>'derivation_label','') NOT IN ('BG-derived','Client-supplied','Owner-stated (public)') OR (_manifest->>'derivation_label'='Owner-stated (public)' AND public.bg_effective_derivation(_manifest->>'derivation_label',_manifest->>'proposition_source',_manifest->>'proposition_source_date',_manifest->>'proposition_source_quote')<>'Owner-stated (public)') OR coalesce(length(btrim(_manifest->>'subject_brand')),0)=0 THEN RAISE EXCEPTION 'BASELINE_PROPOSITION_EVIDENCE_INSUFFICIENT'; END IF;
 INSERT INTO public.current_position_addon_jobs(session_id,source_version,actor_id,proposition,source_manifest,source_fingerprint,entry_path)
 VALUES(_session,_version,_actor,_proposition,_manifest,md5(to_jsonb(s)::text),'addon') ON CONFLICT DO NOTHING RETURNING id INTO j;
 IF j IS NULL THEN SELECT id INTO j FROM public.current_position_addon_jobs WHERE session_id=_session AND source_version=_version AND lower(btrim(source_manifest->>'subject_brand'))=lower(btrim(_manifest->>'subject_brand')); END IF;
 RETURN j;
END $function$;

CREATE OR REPLACE FUNCTION public.bg_validate_autoqueue()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v integer;
BEGIN
 IF OLD.locked_at IS NULL AND NEW.locked_at IS NOT NULL AND NEW.validate_brief IS NOT NULL THEN
  SELECT count(DISTINCT created_at)+1 INTO v FROM public.run_output_versions WHERE run_table='sessions' AND run_id=NEW.id;
  INSERT INTO public.current_position_addon_jobs(session_id,source_version,actor_id,proposition,source_manifest,source_fingerprint,entry_path)
  VALUES(NEW.id,v,coalesce(NEW.locked_by,NEW.user_id),NEW.current_proposition,jsonb_build_object('derivation_label',public.bg_effective_derivation(NEW.validate_brief->>'derivationLabel',NEW.validate_brief->>'source',NEW.validate_brief->>'sourceDate',NEW.validate_brief->>'sourceQuote'),'requested_derivation_label',NEW.validate_brief->>'derivationLabel','proposition_source_quote',NEW.validate_brief->>'sourceQuote','subject_brand',NEW.brand_name,'category',NEW.category,'proposition',NEW.current_proposition,'proposition_source',NEW.validate_brief->>'source','proposition_source_date',NEW.validate_brief->>'sourceDate','evidence_pending',true,'entry_path','new'),md5(to_jsonb(NEW)::text),'new') ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $function$;

REVOKE ALL ON FUNCTION public.bg_effective_derivation(text,text,text,text) FROM PUBLIC, anon;