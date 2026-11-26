CREATE OR REPLACE FUNCTION public.bg_confirm_checkpoint_c(p_session_id uuid, p_rationale jsonb, p_output text)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid:=auth.uid(); s public.sessions%ROWTYPE; at timestamptz:=now(); answers jsonb; field text; legacy boolean;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Sign in to confirm.' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM public.sessions WHERE id=p_session_id FOR UPDATE;
 IF NOT FOUND OR NOT public.can_access_session(p_session_id,uid) THEN RAISE EXCEPTION 'Run not found.' USING ERRCODE='42501'; END IF;
 IF s.locked_at IS NOT NULL OR coalesce(s.strategy_signoff_confirmed,false) THEN RAISE EXCEPTION 'This run is locked. Its confirmed decision cannot change.' USING ERRCODE='P0001'; END IF;
 IF s.validate_brief IS NOT NULL THEN RAISE EXCEPTION 'Validate runs have comparators, not a selection checkpoint.' USING ERRCODE='P0001'; END IF;
 IF coalesce(s.selected_smp,'')='' THEN RAISE EXCEPTION 'Select a proposition before confirming its rationale' USING ERRCODE='P0001'; END IF;
 IF jsonb_typeof(p_rationale) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Selection rationale is incomplete.' USING ERRCODE='P0001'; END IF;
 legacy:=NOT(p_rationale ? '_expected_smp');
 IF legacy THEN
  IF position(E'Selection Confirmed\n\n'||s.selected_smp||E'\n\n' in coalesce(p_output,''))=0 THEN RAISE EXCEPTION 'The selection changed in another window. Reload before confirming.' USING ERRCODE='P0001'; END IF;
 ELSE
  IF (p_rationale->>'_expected_smp') IS DISTINCT FROM s.selected_smp OR (p_rationale->>'_expected_source') IS DISTINCT FROM s.selection_source THEN RAISE EXCEPTION 'The selection changed in another window. Reload before confirming.' USING ERRCODE='P0001'; END IF;
 END IF;
 answers:=p_rationale-'_expected_smp'-'_expected_source'-'_expected_output';
 FOREACH field IN ARRAY ARRAY['f1','f2','f3','f4'] LOOP
  IF jsonb_typeof(answers->field) IS DISTINCT FROM 'string' OR coalesce(trim(answers->>field),'')='' OR length(answers->>field)>5000 THEN RAISE EXCEPTION 'Selection rationale is incomplete.' USING ERRCODE='P0001'; END IF;
 END LOOP;
 IF s.selection_source IN ('LOC','COMBINED') AND coalesce(trim(answers->>'f_loc_legacy'),'')='' THEN RAISE EXCEPTION 'The LOC legacy relationship must be supplied before confirmation.' USING ERRCODE='P0001'; END IF;
 IF coalesce(s.checkpoint_c_confirmed,false) THEN
  IF s.selection_rationale=answers THEN RETURN s.checkpoint_c_confirmed_at; END IF;
  RAISE EXCEPTION 'This selection is already confirmed. Choose again before changing its decision.' USING ERRCODE='P0001';
 END IF;
 IF NOT legacy AND (p_rationale->>'_expected_output') IS DISTINCT FROM s.stage_12_output THEN RAISE EXCEPTION 'The saved proposition set changed. Reload before confirming.' USING ERRCODE='P0001'; END IF;
 IF coalesce(trim(p_output),'')='' THEN RAISE EXCEPTION 'The selection rationale output is missing.' USING ERRCODE='P0001'; END IF;
 UPDATE public.sessions SET selection_rationale=answers,stage_12_output=p_output,version_reason='Checkpoint C: saved human selection rationale',version_actor=uid,checkpoint_c_confirmed=true,checkpoint_c_confirmed_at=at WHERE id=p_session_id;
 INSERT INTO public.checkpoint_confirmations(session_id,checkpoint,confirmed_by,confirmed_at,selected_smp) VALUES(p_session_id,'c',uid,at,s.selected_smp);
 RETURN at;
END $$;
REVOKE ALL ON FUNCTION public.bg_confirm_checkpoint_c(uuid,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bg_confirm_checkpoint_c(uuid,jsonb,text) TO authenticated;