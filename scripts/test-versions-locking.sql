-- F1b tests: versions, locking, claims. Self-rolling-back: run with psql -v ON_ERROR_STOP=1 -f.
BEGIN;
CREATE TEMP TABLE r(name text, ok boolean);

-- Legacy rows were flagged, never given invented versions.
INSERT INTO r SELECT 'legacy sessions flagged earlier_versions_kept=false', bool_and(NOT earlier_versions_kept) FROM public.sessions WHERE created_at < '2026-10-15 01:30+00';
INSERT INTO r SELECT 'legacy workspaces flagged earlier_versions_kept=false', coalesce(bool_and(NOT earlier_versions_kept), true) FROM public.briefing_room_workspaces WHERE created_at < '2026-10-15 01:30+00';
INSERT INTO r SELECT 'legacy synthesiser runs claims_stored=false', coalesce(bool_and(NOT claims_stored), true) FROM public.synthesiser_runs WHERE created_at < '2026-10-15 01:30+00';
INSERT INTO r SELECT 'no versions invented for legacy runs', NOT EXISTS (SELECT 1 FROM public.run_output_versions);

-- Test session (copied minimal fields from an existing row's owner).
INSERT INTO public.sessions (id, brand_name, category, strategic_mode, brief_text, status, current_stage, user_id, stage_1_output, stage_2_output, stage_status)
SELECT '00000000-0000-0000-0000-00000000f1b1', 'F1b test', 'test', strategic_mode, 'brief', 'running', 2, user_id, 'S1 v1', 'S2 v1', 'complete:2'
FROM public.sessions WHERE user_id IS NOT NULL LIMIT 1;
INSERT INTO r SELECT 'new run has earlier_versions_kept=true', earlier_versions_kept FROM public.sessions WHERE id = '00000000-0000-0000-0000-00000000f1b1';

-- Retry clears stages 1-2 with reason + actor -> both saved, current cleared, transient fields consumed.
UPDATE public.sessions SET stage_1_output = NULL, stage_2_output = NULL, stage_status = 'running:1',
  version_reason = 'retry: stage 1', version_actor = user_id WHERE id = '00000000-0000-0000-0000-00000000f1b1';
INSERT INTO r SELECT 'retry saves every cleared output', count(*) = 2 AND bool_and(reason = 'retry: stage 1' AND version_no = 1 AND created_by IS NOT NULL)
  FROM public.run_output_versions WHERE run_id = '00000000-0000-0000-0000-00000000f1b1';
INSERT INTO r SELECT 'saved content matches previous output', content = to_jsonb('S1 v1'::text) FROM public.run_output_versions WHERE run_id = '00000000-0000-0000-0000-00000000f1b1' AND field = 'stage_1_output';
INSERT INTO r SELECT 'transient reason/actor cleared', version_reason IS NULL AND version_actor IS NULL FROM public.sessions WHERE id = '00000000-0000-0000-0000-00000000f1b1';

-- Streaming partial writes while running are not versioned.
UPDATE public.sessions SET stage_1_output = 'S1 v2 partial' WHERE id = '00000000-0000-0000-0000-00000000f1b1';
UPDATE public.sessions SET stage_1_output = 'S1 v2 partial more' WHERE id = '00000000-0000-0000-0000-00000000f1b1';
INSERT INTO r SELECT 'streaming partials not versioned', count(*) = 1 FROM public.run_output_versions WHERE run_id = '00000000-0000-0000-0000-00000000f1b1' AND field = 'stage_1_output';

-- Overwrite of a finished output is versioned with next number.
UPDATE public.sessions SET stage_status = 'complete:1' WHERE id = '00000000-0000-0000-0000-00000000f1b1';
UPDATE public.sessions SET stage_1_output = 'S1 v3' WHERE id = '00000000-0000-0000-0000-00000000f1b1';
INSERT INTO r SELECT 'overwrite of finished output versioned as v2', max(version_no) = 2 FROM public.run_output_versions WHERE run_id = '00000000-0000-0000-0000-00000000f1b1' AND field = 'stage_1_output';

-- Completion auto-locks.
UPDATE public.sessions SET phase_2_status = 'complete' WHERE id = '00000000-0000-0000-0000-00000000f1b1';
INSERT INTO r SELECT 'completed run auto-locks', locked_at IS NOT NULL AND lock_reason = 'Run completed' FROM public.sessions WHERE id = '00000000-0000-0000-0000-00000000f1b1';

-- Locked content cannot change; documents fields still can.
DO $$ BEGIN
  BEGIN
    UPDATE public.sessions SET stage_1_output = NULL WHERE id = '00000000-0000-0000-0000-00000000f1b1';
    INSERT INTO r VALUES ('locked output change refused', false);
  EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('locked output change refused', SQLERRM LIKE '%locked%');
  END;
  BEGIN
    UPDATE public.sessions SET checkpoint_a_confirmed = true WHERE id = '00000000-0000-0000-0000-00000000f1b1';
    INSERT INTO r VALUES ('locked checkpoint change refused', false);
  EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('locked checkpoint change refused', true);
  END;
  BEGIN
    UPDATE public.sessions SET locked_at = NULL WHERE id = '00000000-0000-0000-0000-00000000f1b1';
    INSERT INTO r VALUES ('lock cannot be removed', false);
  EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('lock cannot be removed', true);
  END;
END $$;
UPDATE public.sessions SET doc_agency_status = 'ready' WHERE id = '00000000-0000-0000-0000-00000000f1b1';
INSERT INTO r SELECT 'document status still writable on locked run', doc_agency_status = 'ready' FROM public.sessions WHERE id = '00000000-0000-0000-0000-00000000f1b1';

-- Briefing Room rerun versions overwritten steps; admin-style early lock blocks content.
INSERT INTO public.briefing_room_workspaces (id, user_id, brand_name, category, raw_brief, diagnosis, truths)
SELECT '00000000-0000-0000-0000-00000000f1b2', user_id, 'F1b test', 'test', 'brief brief brief brief', '{"d":1}', '{"t":1}' FROM public.sessions WHERE user_id IS NOT NULL LIMIT 1;
UPDATE public.briefing_room_workspaces SET diagnosis = '{"d":2}', truths = NULL, version_reason = 'rerun: Step 1' WHERE id = '00000000-0000-0000-0000-00000000f1b2';
INSERT INTO r SELECT 'briefing rerun saves diagnosis + cleared truths', count(*) = 2 AND bool_and(reason = 'rerun: Step 1') FROM public.run_output_versions WHERE run_id = '00000000-0000-0000-0000-00000000f1b2';
UPDATE public.briefing_room_workspaces SET locked_at = now(), lock_reason = 'admin test' WHERE id = '00000000-0000-0000-0000-00000000f1b2';
DO $$ BEGIN
  BEGIN
    UPDATE public.briefing_room_workspaces SET truths = '{"t":9}' WHERE id = '00000000-0000-0000-0000-00000000f1b2';
    INSERT INTO r VALUES ('locked workspace refuses rerun', false);
  EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('locked workspace refuses rerun', SQLERRM LIKE '%admin test%');
  END;
END $$;

-- Claims: labels fixed list.
INSERT INTO public.synthesiser_runs (id, user_id, brand_name, status, claim_count)
SELECT '00000000-0000-0000-0000-00000000f1b3', user_id, 'F1b test', 'applied', 1 FROM public.sessions WHERE user_id IS NOT NULL LIMIT 1;
INSERT INTO public.synthesiser_claims (synthesiser_run_id, heading, claim_text, label, source, position)
VALUES ('00000000-0000-0000-0000-00000000f1b3', 'Brand Health Tracking Data', 'claim', 'verified', 'doc.pdf', 1);
INSERT INTO r SELECT 'claim stored', count(*) = 1 FROM public.synthesiser_claims WHERE synthesiser_run_id = '00000000-0000-0000-0000-00000000f1b3';
DO $$ BEGIN
  BEGIN
    INSERT INTO public.synthesiser_claims (synthesiser_run_id, heading, claim_text, label, position)
    VALUES ('00000000-0000-0000-0000-00000000f1b3', 'h', 'c', 'probably', 2);
    INSERT INTO r VALUES ('unknown claim label rejected', false);
  EXCEPTION WHEN check_violation THEN INSERT INTO r VALUES ('unknown claim label rejected', true);
  END;
END $$;

-- Access: app roles cannot write versions or call the trigger function.
INSERT INTO r SELECT 'authenticated cannot insert versions', NOT has_table_privilege('authenticated', 'public.run_output_versions', 'INSERT');
INSERT INTO r SELECT 'anon cannot read versions', NOT has_table_privilege('anon', 'public.run_output_versions', 'SELECT');
INSERT INTO r SELECT 'authenticated cannot update/delete claims', NOT has_table_privilege('authenticated', 'public.synthesiser_claims', 'UPDATE') AND NOT has_table_privilege('authenticated', 'public.synthesiser_claims', 'DELETE');

SELECT CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result, name FROM r;
SELECT count(*) FILTER (WHERE ok) AS passed, count(*) FILTER (WHERE NOT ok OR ok IS NULL) AS failed FROM r;
ROLLBACK;
