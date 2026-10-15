-- F1a database tests. Everything runs in one transaction and is rolled back.
-- Run: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f scripts/test-bg-foundation.sql
BEGIN;
CREATE TEMP TABLE t_results(name text, ok boolean, detail text) ON COMMIT DROP;
GRANT ALL ON t_results TO authenticated, service_role;
SET LOCAL ROLE service_role;

DO $$
DECLARE
  adm uuid := (SELECT id FROM public.users WHERE is_admin LIMIT 1);
  c1 uuid; c2 uuid; e1 uuid; e2 uuid; s1 uuid; s2 uuid; s3 uuid; r1 uuid; ws uuid; br uuid; s4 uuid;
  st text; cid uuid; eid uuid; ok boolean; apv uuid; outbox_before int; outbox_after int;
BEGIN
  INSERT INTO public.bg_clients(name) VALUES ('Marlowe Motor Company (test)') RETURNING id INTO c1;
  INSERT INTO public.bg_clients(name) VALUES ('Other client (test)') RETURNING id INTO c2;
  INSERT INTO public.bg_engagements(bg_client_id, name) VALUES (c1, 'Launch (test)') RETURNING id INTO e1;
  INSERT INTO public.bg_engagements(bg_client_id, name) VALUES (c2, 'Other (test)') RETURNING id INTO e2;
  INSERT INTO public.bg_external_ids(bg_client_id, system, external_id) VALUES (c1, 'hub_client', 'test-hub-mmc');
  INSERT INTO public.bg_external_ids(bg_client_id, engagement_id, system, external_id) VALUES (c1, e1, 'hub_job', 'test-job-1');

  -- One-to-one mapping
  BEGIN INSERT INTO public.bg_external_ids(bg_client_id, system, external_id) VALUES (c2, 'hub_client', 'test-hub-mmc'); ok := false;
  EXCEPTION WHEN unique_violation THEN ok := true; END;
  INSERT INTO t_results VALUES ('hub id maps to only one client', ok, NULL);
  BEGIN INSERT INTO public.bg_external_ids(bg_client_id, system, external_id) VALUES (c1, 'hub_client', 'test-hub-mmc-2'); ok := false;
  EXCEPTION WHEN unique_violation THEN ok := true; END;
  INSERT INTO t_results VALUES ('client has only one hub client id', ok, NULL);
  BEGIN INSERT INTO public.bg_external_ids(bg_client_id, engagement_id, system, external_id) VALUES (c1, e2, 'hub_job', 'test-job-x'); ok := false;
  EXCEPTION WHEN raise_exception THEN ok := true; END;
  INSERT INTO t_results VALUES ('job cannot map to another client''s engagement', ok, NULL);

  -- Hub-opened run with valid tags -> linked; unknown tags -> unlinked
  INSERT INTO public.sessions(brand_name, category, strategic_mode, brief_text, status, current_stage, user_id, hub_client, hub_job)
    VALUES ('BG test brand', 'test', 'standard', 'test brief text long enough', 'running', 1, adm, 'test-hub-mmc', 'test-job-1')
    RETURNING id, link_status, bg_client_id, engagement_id INTO s1, st, cid, eid;
  INSERT INTO t_results VALUES ('hub run with valid tags is linked', st = 'linked' AND cid = c1 AND eid = e1, st);
  INSERT INTO public.sessions(brand_name, category, strategic_mode, brief_text, status, current_stage, user_id, hub_client, hub_job)
    VALUES ('BG test brand', 'test', 'standard', 'test brief text long enough', 'running', 1, adm, 'unknown-client', 'test-job-1')
    RETURNING id, link_status INTO s2, st;
  INSERT INTO t_results VALUES ('hub run with unknown tags is unlinked', st = 'unlinked', st);
  INSERT INTO public.sessions(brand_name, category, strategic_mode, brief_text, status, current_stage, user_id)
    VALUES ('BG test brand', 'test', 'standard', 'test brief text long enough', 'running', 1, adm)
    RETURNING id, link_status INTO s3, st;
  INSERT INTO t_results VALUES ('run without hub context is unlinked', st = 'unlinked', st);
  -- Tagged after creation (Hub banner stamp)
  UPDATE public.sessions SET hub_client = 'test-hub-mmc', hub_job = 'test-job-1' WHERE id = s3 RETURNING link_status INTO st;
  INSERT INTO t_results VALUES ('run tagged after creation is linked', st = 'linked', st);
  -- Brand name is never used
  SELECT link_status INTO st FROM public.sessions WHERE id = s2;
  INSERT INTO t_results VALUES ('same brand name does not link', st = 'unlinked', st);

  -- Derived runs inherit
  INSERT INTO public.stimulus_runs(session_id, channel_name, channel_brief, smp, created_by)
    VALUES (s1, 'test', '', '', adm) RETURNING id, link_status, bg_client_id, engagement_id INTO r1, st, cid, eid;
  INSERT INTO t_results VALUES ('creative run inherits from pipeline run', st = 'linked' AND cid = c1 AND eid = e1, st);
  INSERT INTO public.intelligence_sessions(user_id, brand_name, hub_client, hub_job) VALUES (adm, 'BG test brand', 'test-hub-mmc', 'test-job-1')
    RETURNING id INTO ws;
  INSERT INTO public.briefing_room_workspaces(user_id, brand_name, category, raw_brief, supporting_evidence, bg_source_id)
    VALUES (adm, 'BG test brand', 'test', 'x', '[]'::jsonb, ws) RETURNING id, link_status INTO ws, st;
  INSERT INTO t_results VALUES ('briefing workspace inherits from intelligence session', st = 'linked', st);
  INSERT INTO public.saved_briefs(user_id, brand_name, category, brief_text, bg_source_id)
    VALUES (adm, 'BG test brand', 'test', 'x', ws) RETURNING brief_id, link_status INTO br, st;
  INSERT INTO t_results VALUES ('saved brief inherits from workspace', st = 'linked', st);
  INSERT INTO public.sessions(brand_name, category, strategic_mode, brief_text, status, current_stage, user_id, bg_source_id)
    VALUES ('BG test brand', 'test', 'standard', 'test brief text long enough', 'running', 1, adm, br)
    RETURNING id, link_status, engagement_id INTO s4, st, eid;
  INSERT INTO t_results VALUES ('pipeline run inherits from saved brief', st = 'linked' AND eid = e1, st);

  -- Existing runs stayed legacy
  SELECT count(*) = 0 INTO ok FROM public.intelligence_sessions WHERE brand_name ILIKE 'nissan%' AND link_status <> 'legacy';
  INSERT INTO t_results VALUES ('Nissan runs stay legacy', ok, NULL);

  -- Approver recorded (service-side write supplies id; signed-in write uses auth.uid())
  outbox_before := (SELECT count(*) FROM public.hub_outbox);
  UPDATE public.sessions SET checkpoint_d_confirmed = true, checkpoint_d_confirmed_at = now(), checkpoint_d_confirmed_by = adm WHERE id = s1
    RETURNING checkpoint_d_confirmed_by INTO apv;
  INSERT INTO t_results VALUES ('approver recorded on server confirm', apv = adm, NULL);
  UPDATE public.sessions SET checkpoint_d_confirmed_at = NULL WHERE id = s1 RETURNING checkpoint_d_confirmed_by INTO apv;
  INSERT INTO t_results VALUES ('approver cleared when approval cleared', apv IS NULL, NULL);
  UPDATE public.stimulus_runs SET gate_one_confirmed = true, gate_one_confirmed_at = now(), gate_one_confirmed_by = adm, status = 'gate_one' WHERE id = r1
    RETURNING gate_one_confirmed_by INTO apv;
  INSERT INTO t_results VALUES ('gate one approver recorded', apv = adm, NULL);
  outbox_after := (SELECT count(*) FROM public.hub_outbox);
  INSERT INTO t_results VALUES ('checkpoint still queues its hub event', outbox_after > outbox_before, (outbox_after - outbox_before)::text);

  -- Status lists
  BEGIN UPDATE public.stimulus_runs SET status = 'bogus' WHERE id = r1; ok := false;
  EXCEPTION WHEN check_violation THEN ok := true; END;
  INSERT INTO t_results VALUES ('creative run rejects unknown status', ok, NULL);
  BEGIN UPDATE public.briefing_room_workspaces SET status = 'bogus' WHERE id = ws; ok := false;
  EXCEPTION WHEN check_violation THEN ok := true; END;
  INSERT INTO t_results VALUES ('briefing workspace rejects unknown status', ok, NULL);
  UPDATE public.stimulus_runs SET status = 'complete' WHERE id = r1;
  INSERT INTO t_results VALUES ('known status still accepted', true, NULL);

  PERFORM set_config('t.s2', s2::text, true); PERFORM set_config('t.s1', s1::text, true);
  PERFORM set_config('t.c1', c1::text, true); PERFORM set_config('t.e1', e1::text, true);
  PERFORM set_config('t.adm', adm::text, true);
END $$;

-- As a signed-in non-admin: cannot see/create clients, cannot self-link, cannot forge approver.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000beef', 'role', 'authenticated')::text, true);
DO $$
DECLARE ok boolean; n int;
BEGIN
  SELECT count(*) INTO n FROM public.bg_clients;
  INSERT INTO t_results VALUES ('non-admin sees no clients', n = 0, n::text);
  BEGIN INSERT INTO public.bg_clients(name) VALUES ('x'); ok := false; EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  INSERT INTO t_results VALUES ('non-admin cannot create clients', ok, NULL);
  BEGIN PERFORM public.bg_admin_link_run('sessions', current_setting('t.s2')::uuid, current_setting('t.c1')::uuid, current_setting('t.e1')::uuid); ok := false;
  EXCEPTION WHEN raise_exception THEN ok := true; END;
  INSERT INTO t_results VALUES ('non-admin cannot link runs', ok, NULL);
END $$;
-- As the admin: link one run, recorded.
SELECT set_config('request.jwt.claims', json_build_object('sub', current_setting('t.adm'), 'role', 'authenticated')::text, true);
DO $$
DECLARE st text; n int;
BEGIN
  st := public.bg_admin_link_run('sessions', current_setting('t.s2')::uuid, current_setting('t.c1')::uuid, current_setting('t.e1')::uuid);
  SELECT count(*) INTO n FROM public.bg_link_events WHERE run_id = current_setting('t.s2')::uuid AND linked_by = current_setting('t.adm')::uuid;
  INSERT INTO t_results VALUES ('admin links a run and it is recorded', st = 'linked' AND n = 1, st);
  -- Owner-style direct update cannot change the link
  UPDATE public.sessions SET bg_client_id = NULL, link_status = 'unlinked' WHERE id = current_setting('t.s2')::uuid;
  SELECT link_status INTO st FROM public.sessions WHERE id = current_setting('t.s2')::uuid;
  INSERT INTO t_results VALUES ('direct update cannot change a link', st = 'linked', st);
  -- Signed-in confirm records auth.uid()
  UPDATE public.sessions SET checkpoint_a_confirmed = true, checkpoint_a_confirmed_at = now() WHERE id = current_setting('t.s1')::uuid;
  SELECT CASE WHEN checkpoint_a_confirmed_by = current_setting('t.adm')::uuid THEN 'ok' ELSE 'missing' END INTO st FROM public.sessions WHERE id = current_setting('t.s1')::uuid;
  INSERT INTO t_results VALUES ('approver recorded on signed-in confirm', st = 'ok', st);
END $$;
RESET ROLE;

SELECT name, CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result, detail FROM t_results;
SELECT count(*) FILTER (WHERE NOT ok) AS failures, count(*) AS total FROM t_results;
ROLLBACK;
