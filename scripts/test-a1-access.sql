-- A1 access point database tests. Self-rolling-back (ends with RAISE).
CREATE TEMP TABLE r(name text, ok boolean);

-- Keys: hash only, never deleted, only revoked_at may change, revocation is final.
INSERT INTO public.bg_access_keys(id, scope, label, key_hash) VALUES ('00000000-0000-0000-0000-0000000a1001', 'hub_tools', 'a1 test', repeat('a', 64));
DO $$ BEGIN
  BEGIN INSERT INTO public.bg_access_keys(scope, label, key_hash) VALUES ('hub_tools', 'plain', 'bgk_plaintext'); INSERT INTO r VALUES ('non-hash key rejected', false);
  EXCEPTION WHEN check_violation THEN INSERT INTO r VALUES ('non-hash key rejected', true); END;
  BEGIN INSERT INTO public.bg_access_keys(scope, label, key_hash) VALUES ('everything', 'x', repeat('b', 64)); INSERT INTO r VALUES ('unknown scope rejected', false);
  EXCEPTION WHEN check_violation THEN INSERT INTO r VALUES ('unknown scope rejected', true); END;
  BEGIN UPDATE public.bg_access_keys SET scope = 'admin' WHERE id = '00000000-0000-0000-0000-0000000a1001'; INSERT INTO r VALUES ('scope cannot change', false);
  EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('scope cannot change', true); END;
  UPDATE public.bg_access_keys SET revoked_at = now() WHERE id = '00000000-0000-0000-0000-0000000a1001';
  BEGIN UPDATE public.bg_access_keys SET revoked_at = NULL WHERE id = '00000000-0000-0000-0000-0000000a1001'; INSERT INTO r VALUES ('revocation is final', false);
  EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('revocation is final', true); END;
  BEGIN DELETE FROM public.bg_access_keys WHERE id = '00000000-0000-0000-0000-0000000a1001'; INSERT INTO r VALUES ('keys never deleted', false);
  EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('keys never deleted', true); END;
END $$;

-- Log: append-only.
INSERT INTO public.bg_access_log(request_id, outcome) VALUES (gen_random_uuid(), 'success');
DO $$ BEGIN
  BEGIN UPDATE public.bg_access_log SET outcome = 'error'; INSERT INTO r VALUES ('log update refused', false);
  EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('log update refused', SQLERRM LIKE '%append-only%'); END;
  BEGIN DELETE FROM public.bg_access_log; INSERT INTO r VALUES ('log delete refused', false);
  EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('log delete refused', SQLERRM LIKE '%append-only%'); END;
END $$;
INSERT INTO r SELECT 'log has no key/secret/content columns', NOT EXISTS (
  SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bg_access_log'
  AND column_name IN ('key','key_hash','secret','content','body','params','response'));

-- No person gains access: app roles have no privileges on either table.
INSERT INTO r SELECT 'signed-in and anonymous users cannot read keys or log',
  NOT has_table_privilege('authenticated', 'public.bg_access_keys', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.bg_access_keys', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.bg_access_log', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.bg_access_log', 'INSERT');
INSERT INTO r SELECT 'service role can only append to the log', has_table_privilege('service_role', 'public.bg_access_log', 'INSERT')
  AND NOT has_table_privilege('service_role', 'public.bg_access_log', 'UPDATE')
  AND NOT has_table_privilege('service_role', 'public.bg_access_log', 'DELETE');

-- Run-complete notice: existing run event carries Hub client and job refs, no content.
INSERT INTO public.sessions (id, brand_name, category, brief_text, status, current_stage, hub_client, hub_job)
VALUES ('00000000-0000-0000-0000-0000000a1002', 'A1 notice', 'test', 'SECRET BRIEF', 'running', 22, 'a1-test-client', 'a1-test-job');
UPDATE public.sessions SET status = 'complete', stage_2_output = 'SECRET OUTPUT' WHERE id = '00000000-0000-0000-0000-0000000a1002';
INSERT INTO r SELECT 'run_completed carries client_ref and job_ref, no content',
  count(*) = 1 AND bool_and(payload->>'client_ref' = 'a1-test-client' AND payload->>'job_ref' = 'a1-test-job'
    AND payload::text NOT LIKE '%SECRET%' AND NOT payload ? 'content')
  FROM public.hub_outbox WHERE hub_client = 'a1-test-client' AND payload->>'event_type' = 'run_completed';

DO $$ BEGIN
  RAISE EXCEPTION 'A1_TEST_RESULTS passed=% failed=% :: %',
    (SELECT count(*) FILTER (WHERE ok) FROM r), (SELECT count(*) FILTER (WHERE ok IS NOT TRUE) FROM r),
    (SELECT string_agg(CASE WHEN ok THEN 'PASS ' ELSE 'FAIL ' END || name, ' | ') FROM r);
END $$;
