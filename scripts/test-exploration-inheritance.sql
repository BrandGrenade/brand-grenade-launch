-- Self-rolling-back database tests. Never starts a stage or changes the source run.
CREATE TEMP TABLE exploration_checks(name text,ok boolean);
DO $$ DECLARE b public.current_position_addon_jobs; s public.sessions; t uuid; brief jsonb; BEGIN
 SELECT * INTO b FROM public.current_position_addon_jobs WHERE id='fe31e8a4-d143-4ea9-bfbd-5f9e8cf7a30c';
 SELECT * INTO s FROM public.sessions WHERE id=b.session_id;
 IF s.id IS NULL THEN RAISE EXCEPTION 'Required saved test baseline is absent'; END IF;
 brief:=jsonb_build_object('mode','headroom','baselineJobId',b.id,'market','UK','growthAmbition','Test','timeHorizon','Test','constraints','Test','categoriesAndMarkets','Test');
 INSERT INTO public.sessions(user_id,brand_name,category,brief_text,status,current_stage,run_mode,exploration_brief,test_copy_of)
 VALUES(s.user_id,'Infiniti','Auto','Test','running',1,'diagnostic',brief,s.id) RETURNING id INTO t;
 INSERT INTO exploration_checks SELECT 'new test inherits the saved baseline client',bg_client_id=s.bg_client_id AND test_copy_of=s.id FROM public.sessions WHERE id=t;
 INSERT INTO exploration_checks SELECT 'new test has no approvals or later stage output',NOT checkpoint_a_confirmed AND stage_2_output IS NULL FROM public.sessions WHERE id=t;
 BEGIN
  INSERT INTO public.sessions(user_id,brand_name,category,brief_text,status,current_stage,run_mode,exploration_brief,test_copy_of,hub_client)
  VALUES(s.user_id,'Infiniti','Auto','Test','running',1,'diagnostic',brief,s.id,'not-a-mapped-client');
  INSERT INTO exploration_checks VALUES('conflicting Hub client refused',false);
 EXCEPTION WHEN raise_exception THEN INSERT INTO exploration_checks VALUES('conflicting Hub client refused',SQLERRM='EXPLORATION_BASELINE_CLIENT_MISMATCH'); END;
 BEGIN
  INSERT INTO public.sessions(user_id,brand_name,category,brief_text,status,current_stage,run_mode,exploration_brief,test_copy_of)
  VALUES('00000000-0000-4000-8000-000000000099','Infiniti','Auto','Test','running',1,'diagnostic',brief,s.id);
  INSERT INTO exploration_checks VALUES('unrelated owner refused',false);
 EXCEPTION WHEN raise_exception THEN INSERT INTO exploration_checks VALUES('unrelated owner refused',SQLERRM='EXPLORATION_BASELINE_ACCESS_DENIED'); END;
END $$;
DO $$ BEGIN RAISE EXCEPTION 'EXPLORATION_TEST_RESULTS passed=% failed=% :: %',
 (SELECT count(*) FILTER(WHERE ok) FROM exploration_checks),(SELECT count(*) FILTER(WHERE ok IS NOT TRUE) FROM exploration_checks),
 (SELECT string_agg(CASE WHEN ok THEN 'PASS ' ELSE 'FAIL ' END||name,' | ') FROM exploration_checks); END $$;