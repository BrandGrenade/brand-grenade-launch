-- Stage 16 on locked runs: first save allowed, regeneration admin-only with reason,
-- everything else still refused. Self-rolling-back: ends by raising S16_LOCK_RESULTS.
CREATE TEMP TABLE r(name text, ok boolean);
GRANT ALL ON r TO authenticated;

INSERT INTO public.sessions (id, brand_name, category, strategic_mode, brief_text, status, current_stage, user_id, stage_1_output, stage_status)
SELECT '00000000-0000-0000-0000-0000000016a1', 'S16 lock test', 'test', strategic_mode, 'brief', 'running', 15, user_id, 'S1', 'complete:15'
FROM public.sessions WHERE user_id IS NOT NULL LIMIT 1;
UPDATE public.sessions SET phase_2_status = 'complete' WHERE id = '00000000-0000-0000-0000-0000000016a1';
INSERT INTO r SELECT 'run locked on completion', locked_at IS NOT NULL FROM public.sessions WHERE id = '00000000-0000-0000-0000-0000000016a1';

-- First save (streamed partials then final) is allowed on a locked run.
UPDATE public.sessions SET stage_16_vision_output = 'partial', status = 'running', current_stage = 16 WHERE id = '00000000-0000-0000-0000-0000000016a1';
UPDATE public.sessions SET stage_16_vision_output = 'partial more' WHERE id = '00000000-0000-0000-0000-0000000016a1';
UPDATE public.sessions SET stage_16_vision_output = 'VISION FINAL', stage_16_error = NULL, status = 'complete', stage_status = 'complete:16' WHERE id = '00000000-0000-0000-0000-0000000016a1';
INSERT INTO r SELECT 'first Stage 16 save allowed on locked run', stage_16_vision_output = 'VISION FINAL' AND 'vision' = ANY(stage_16_completed_formats) FROM public.sessions WHERE id = '00000000-0000-0000-0000-0000000016a1';
INSERT INTO r SELECT 'locked run status unchanged by document save', status <> 'running' AND current_stage = 15 AND stage_status = 'complete:15' FROM public.sessions WHERE id = '00000000-0000-0000-0000-0000000016a1';

DO $$ BEGIN
  BEGIN
    UPDATE public.sessions SET stage_16_vision_output = NULL WHERE id = '00000000-0000-0000-0000-0000000016a1';
    INSERT INTO r VALUES ('regenerating saved document without grant refused', false);
  EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('regenerating saved document without grant refused', SQLERRM LIKE '%admin-only%');
  END;
  BEGIN
    UPDATE public.sessions SET stage_1_output = 'changed' WHERE id = '00000000-0000-0000-0000-0000000016a1';
    INSERT INTO r VALUES ('other output still refused', false);
  EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('other output still refused', SQLERRM LIKE '%locked%');
  END;
  BEGIN
    UPDATE public.sessions SET stage_16_agency_output = 'A', stage_1_output = 'changed' WHERE id = '00000000-0000-0000-0000-0000000016a1';
    INSERT INTO r VALUES ('Stage 16 write cannot carry other changes', false);
  EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('Stage 16 write cannot carry other changes', true);
  END;
  BEGIN
    UPDATE public.sessions SET checkpoint_a_confirmed = NOT coalesce(checkpoint_a_confirmed,false) WHERE id = '00000000-0000-0000-0000-0000000016a1';
    INSERT INTO r VALUES ('checkpoint still refused', false);
  EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('checkpoint still refused', true);
  END;
  BEGIN
    UPDATE public.sessions SET locked_at = NULL WHERE id = '00000000-0000-0000-0000-0000000016a1';
    INSERT INTO r VALUES ('lock cannot be removed', false);
  EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('lock cannot be removed', true);
  END;
  BEGIN
    UPDATE public.sessions SET stage_16_completed_formats = '{}' WHERE id = '00000000-0000-0000-0000-0000000016a1';
    INSERT INTO r SELECT 'saved-document record cannot be reset', 'vision' = ANY(stage_16_completed_formats) FROM public.sessions WHERE id = '00000000-0000-0000-0000-0000000016a1';
  END;
END $$;

-- Non-admin signed-in user cannot open a regeneration grant.
DO $$ DECLARE nonadmin uuid; BEGIN
  SELECT id INTO nonadmin FROM auth.users u WHERE NOT public.bg_is_admin(u.id) LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', nonadmin, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.bg_grant_stage16_regeneration('00000000-0000-0000-0000-0000000016a1', 'vision', 'try');
    INSERT INTO r VALUES ('non-admin cannot grant regeneration', false);
  EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('non-admin cannot grant regeneration', SQLERRM LIKE '%Only an admin%');
  END;
  RESET ROLE;
END $$;

-- Admin grant with reason: old version kept with the reason, then grant closes.
DO $$ DECLARE adm uuid; BEGIN
  SELECT id INTO adm FROM auth.users u WHERE public.bg_is_admin(u.id) LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.bg_grant_stage16_regeneration('00000000-0000-0000-0000-0000000016a1', 'vision', 'Fact correction');
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
END $$;
UPDATE public.sessions SET stage_16_vision_output = NULL WHERE id = '00000000-0000-0000-0000-0000000016a1';
UPDATE public.sessions SET stage_16_vision_output = 'VISION V2', stage_status = 'complete:16' WHERE id = '00000000-0000-0000-0000-0000000016a1';
INSERT INTO r SELECT 'admin regeneration saved', stage_16_vision_output = 'VISION V2' FROM public.sessions WHERE id = '00000000-0000-0000-0000-0000000016a1';
INSERT INTO r SELECT 'old version kept with reason and admin', count(*) = 1 AND bool_and(content = to_jsonb('VISION FINAL'::text) AND reason LIKE '%Fact correction%' AND created_by IS NOT NULL)
  FROM public.run_output_versions WHERE run_id = '00000000-0000-0000-0000-0000000016a1' AND field = 'stage_16_vision_output';
INSERT INTO r SELECT 'grant closed after save', closed_at IS NOT NULL FROM public.run_lock_exemptions WHERE run_id = '00000000-0000-0000-0000-0000000016a1';
DO $$ BEGIN
  BEGIN
    UPDATE public.sessions SET stage_16_vision_output = 'VISION V3' WHERE id = '00000000-0000-0000-0000-0000000016a1';
    INSERT INTO r VALUES ('grant cannot be reused', false);
  EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('grant cannot be reused', true);
  END;
END $$;

DO $$ BEGIN
  RAISE EXCEPTION 'S16_LOCK_RESULTS passed=% failed=% :: %',
    (SELECT count(*) FILTER (WHERE ok) FROM r), (SELECT count(*) FILTER (WHERE ok IS NOT TRUE) FROM r),
    (SELECT string_agg(CASE WHEN ok THEN 'PASS ' ELSE 'FAIL ' END || name, ' | ') FROM r);
END $$;
