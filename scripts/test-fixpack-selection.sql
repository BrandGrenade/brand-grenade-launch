-- Transaction-only fixtures: no model calls, stage runs, or permanent records.
BEGIN;
DO $$
DECLARE run_id uuid := gen_random_uuid(); owner_id uuid; answer jsonb := '{"f1":"A","f2":"B","f3":"C","f4":"D"}'; at timestamptz; n integer; rejected boolean;
BEGIN
 SELECT user_id INTO owner_id FROM public.sessions WHERE user_id IS NOT NULL LIMIT 1;
 IF owner_id IS NULL THEN RAISE EXCEPTION 'No fixture owner'; END IF;
 PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
 INSERT INTO public.sessions(id,user_id,brand_name,category,brief_text,status,current_stage,run_mode,selected_smp,selected_smp_field_name,selection_source,stage_12_output,stage_status)
 VALUES(run_id,owner_id,'Transaction-only selection fixture','Test','Test','running',12,'diagnostic','Saved A','Alpha','CORE','Saved full set','complete:12');
 at := public.bg_confirm_checkpoint_c(run_id,answer,E'Selection Confirmed\n\nSaved A\n\nRationale');
 IF at IS NULL THEN RAISE EXCEPTION 'Confirmation returned no date'; END IF;
 PERFORM public.bg_confirm_checkpoint_c(run_id,answer,E'Selection Confirmed\n\nSaved A\n\nRationale');
 SELECT count(*) INTO n FROM public.checkpoint_confirmations WHERE session_id=run_id AND checkpoint='c';
 IF n<>1 THEN RAISE EXCEPTION 'Identical confirmation created % records, expected 1',n; END IF;
 rejected:=false;
 BEGIN
  PERFORM public.bg_confirm_checkpoint_c(run_id,answer||'{"_expected_smp":"Stale B","_expected_source":"CORE"}',E'Selection Confirmed\n\nStale B\n\nRationale');
 EXCEPTION WHEN raise_exception THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Stale confirmation accepted'; END IF;
 rejected:=false;
 BEGIN UPDATE public.sessions SET selected_smp='Stale B' WHERE id=run_id;
 EXCEPTION WHEN raise_exception THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Confirmed selection overwritten by stale save'; END IF;
 UPDATE public.sessions SET stage_13_output='Saved verdict A',stage_status='complete:13' WHERE id=run_id;
 IF EXISTS(SELECT 1 FROM public.sessions WHERE id=run_id AND locked_at IS NOT NULL) THEN RAISE EXCEPTION 'Diagnostic locked before final checkpoint'; END IF;
 PERFORM public.bg_reselect_proposition(run_id,'Saved B','Beta',NULL,'CORE',NULL);
 SELECT count(*) INTO n FROM public.selection_versions WHERE session_id=run_id AND selected_smp='Saved A' AND stage_13_output='Saved verdict A';
 IF n<>1 THEN RAISE EXCEPTION 'Reselection kept % copies of earlier choice, expected 1',n; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sessions WHERE id=run_id AND selected_smp='Saved B' AND checkpoint_c_confirmed=false AND stage_13_output IS NULL) THEN RAISE EXCEPTION 'New selection retained old confirmation or verdict'; END IF;
 PERFORM public.bg_confirm_checkpoint_c(run_id,answer,E'Selection Confirmed\n\nSaved B\n\nRationale');
 UPDATE public.sessions SET stage_13_output='Saved verdict B',stage_status='complete:13',strategy_signoff_confirmed=true WHERE id=run_id;
 IF NOT EXISTS(SELECT 1 FROM public.sessions WHERE id=run_id AND locked_at IS NOT NULL) THEN RAISE EXCEPTION 'Final checkpoint did not lock diagnostic'; END IF;
 rejected:=false;
 BEGIN PERFORM public.bg_reselect_proposition(run_id,'Saved C','Gamma',NULL,'CORE',NULL);
 EXCEPTION WHEN raise_exception THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Locked reselection accepted'; END IF;
 RAISE NOTICE 'Passed: atomic/idempotent C, stale confirmation/save refusal, pre-signoff unlock, one preserved selection/verdict, fresh confirmation, signoff lock and locked refusal.';
END $$;
ROLLBACK;