CREATE OR REPLACE FUNCTION public.bg_preserve_confirmed_selection() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE actor uuid; vno integer; oldj jsonb:=to_jsonb(OLD); newj jsonb:=to_jsonb(NEW); field text; stage_no integer;
BEGIN
 IF NOT coalesce(OLD.checkpoint_c_confirmed,false) OR (NEW.selected_smp IS NOT DISTINCT FROM OLD.selected_smp AND coalesce(NEW.checkpoint_c_confirmed,false)) THEN RETURN NEW; END IF;
 IF OLD.locked_at IS NOT NULL OR coalesce(OLD.strategy_signoff_confirmed,false) THEN RAISE EXCEPTION 'This run is locked. Its confirmed selection cannot change.' USING ERRCODE='P0001'; END IF;
 actor:=coalesce(auth.uid(),NEW.version_actor);
 IF actor IS NULL THEN RAISE EXCEPTION 'A signed-in decision owner is required to change a confirmed selection.' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.selection_versions WHERE session_id=OLD.id AND selected_smp IS NOT DISTINCT FROM OLD.selected_smp AND checkpoint_c_confirmed_at IS NOT DISTINCT FROM OLD.checkpoint_c_confirmed_at AND superseded_at=transaction_timestamp()) THEN
  SELECT coalesce(max(version_no),0)+1 INTO vno FROM public.selection_versions WHERE session_id=OLD.id;
  INSERT INTO public.selection_versions(session_id,version_no,selected_smp,selected_smp_field_name,selection_source,selection_engine,selected_loc_expression,selection_rationale,checkpoint_c_confirmed_at,stage_13_verdict,stage_13_output,superseded_by,reason)
  VALUES(OLD.id,vno,OLD.selected_smp,OLD.selected_smp_field_name,OLD.selection_source,OLD.selection_engine,OLD.selected_loc_expression,OLD.selection_rationale,OLD.checkpoint_c_confirmed_at,OLD.stage_13_verdict,OLD.stage_13_output,actor,coalesce(NEW.version_reason,'Selection reset'));
 END IF;
 newj:=newj||jsonb_build_object('checkpoint_c_confirmed',false,'checkpoint_c_confirmed_at',null,'checkpoint_c_notes',null,'selection_rationale',null,'version_actor',actor);
 FOR field IN SELECT jsonb_object_keys(oldj) LOOP
  IF field~'^stage_[0-9]+[a-z]?_(output|structured|structured_error|error|verdict)$' THEN
   stage_no:=(substring(field from '^stage_([0-9]+)'))::integer;
   IF stage_no>=13 THEN newj:=newj||jsonb_build_object(field,null); END IF;
  END IF;
 END LOOP;
 newj:=newj||jsonb_build_object('stage_16_valuation_output',null);
 NEW:=jsonb_populate_record(NEW,newj);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.bg_preserve_confirmed_selection() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bg_preserve_confirmed_selection() TO service_role;
CREATE TRIGGER a_preserve_confirmed_selection BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.bg_preserve_confirmed_selection();