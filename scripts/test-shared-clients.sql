-- Run in an isolated database with the production functions/migration installed.
-- Always rolls back; no real clients, runs, documents or keys are changed.
BEGIN;
CREATE TEMP TABLE shared_results(name text, ok boolean NOT NULL);
INSERT INTO public.users(id,is_admin) VALUES ('00000000-0000-4000-8000-000000000001',true),('00000000-0000-4000-8000-000000000002',false);
DO $$ DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['synthesiser_runs','intelligence_sessions','briefing_room_workspaces','sessions','saved_briefs','stimulus_runs'] LOOP
 EXECUTE format('CREATE TRIGGER zz_bg_run_link BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.bg_run_link()',t);
 END LOOP;
END $$;
DO $$
DECLARE a uuid; b uuid; c uuid; r uuid; s uuid; w uuid; br uuid; cr uuid; t text; row record; before_count int; after_count int; i int;
BEGIN
 SELECT bg_client_id INTO a FROM public.bg_ensure_client('shared-test-a','Marlowe Motor Company');
 SELECT bg_client_id INTO b FROM public.bg_ensure_client('shared-test-a','Never rename');
 INSERT INTO shared_results VALUES('ensure creates once without renaming',a=b AND (SELECT name='Marlowe Motor Company' FROM bg_clients WHERE id=a));
 SELECT bg_client_id INTO c FROM public.bg_ensure_client('shared-test-c','Marlowe Motor Company');
 INSERT INTO shared_results VALUES('same name never merges clients',a<>c);
 INSERT INTO public.bg_clients(name) VALUES('BG-created client') RETURNING id INTO c;
 INSERT INTO shared_results VALUES('BG-created unmapped client appears in shared list',EXISTS(SELECT 1 FROM public.bg_shared_clients() WHERE bg_client_id=c AND hub_client_id IS NULL));
 SELECT count(*) INTO before_count FROM public.bg_clients;
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
 INSERT INTO shared_results VALUES('unknown arrival lookup has no record',NOT EXISTS(SELECT 1 FROM public.bg_lookup_hub_client('unknown')));
 SELECT count(*) INTO after_count FROM public.bg_clients;
 INSERT INTO shared_results VALUES('unknown arrival lookup never creates',before_count=after_count);
 INSERT INTO shared_results VALUES('known arrival lookup finds client',EXISTS(SELECT 1 FROM public.bg_lookup_hub_client('shared-test-a') WHERE client_id=a));
 INSERT INTO shared_results VALUES('partner cannot enumerate all clients',NOT EXISTS(SELECT 1 FROM public.bg_client_options()));
 INSERT INTO shared_results VALUES('ensure function denied to browser roles',NOT has_function_privilege('authenticated','public.bg_ensure_client(text,text)','EXECUTE') AND NOT has_function_privilege('anon','public.bg_ensure_client(text,text)','EXECUTE'));
 INSERT INTO shared_results VALUES('shared list denied to browser roles',NOT has_function_privilege('authenticated','public.bg_shared_clients()','EXECUTE') AND NOT has_function_privilege('anon','public.bg_shared_clients()','EXECUTE'));
 INSERT INTO shared_results VALUES('Hub service can ensure and list',has_function_privilege('service_role','public.bg_ensure_client(text,text)','EXECUTE') AND has_function_privilege('service_role','public.bg_shared_clients()','EXECUTE'));
 FOREACH t IN ARRAY ARRAY['synthesiser_runs','intelligence_sessions','briefing_room_workspaces','sessions','saved_briefs','stimulus_runs'] LOOP
   EXECUTE format('INSERT INTO public.%I(user_id,created_by,brand_name,hub_client,hub_job) VALUES($1,$1,$2,$3,NULL) RETURNING id,bg_client_id,engagement_id,link_status',t)
     INTO row USING '00000000-0000-4000-8000-000000000002'::uuid,'Unrelated brand','shared-test-a';
   INSERT INTO shared_results VALUES(t || ' client-only start is linked',row.bg_client_id=a AND row.engagement_id IS NULL AND row.link_status='linked');
 END LOOP;
 INSERT INTO sessions(user_id,brand_name,hub_client,hub_job) VALUES('00000000-0000-4000-8000-000000000002','X','shared-test-a','unknown-job') RETURNING link_status INTO t;
 INSERT INTO shared_results VALUES('unknown explicit job stays unlinked',t='unlinked');
 INSERT INTO intelligence_sessions(user_id,brand_name,hub_client) VALUES('00000000-0000-4000-8000-000000000002','X','shared-test-a') RETURNING id INTO s;
 INSERT INTO briefing_room_workspaces(user_id,brand_name,bg_source_id,hub_client) VALUES('00000000-0000-4000-8000-000000000002','X',s,'shared-test-c') RETURNING id,bg_client_id,engagement_id,link_status INTO row;
 w:=row.id;
 INSERT INTO shared_results VALUES('source client-only inheritance wins over arrival',row.bg_client_id=a AND row.engagement_id IS NULL AND row.link_status='linked');
 INSERT INTO saved_briefs(user_id,brand_name,bg_source_id) VALUES('00000000-0000-4000-8000-000000000002','X',w) RETURNING brief_id,bg_client_id,engagement_id,link_status INTO row;
 br:=row.brief_id;
 INSERT INTO shared_results VALUES('saved brief inherits client-only link',row.bg_client_id=a AND row.link_status='linked');
 INSERT INTO sessions(user_id,brand_name,bg_source_id) VALUES('00000000-0000-4000-8000-000000000002','X',br) RETURNING id,bg_client_id,link_status INTO row;
 s:=row.id;
 INSERT INTO shared_results VALUES('pipeline inherits client-only saved brief',row.bg_client_id=a AND row.link_status='linked');
 INSERT INTO stimulus_runs(created_by,session_id,brand_name) VALUES('00000000-0000-4000-8000-000000000002',s,'X') RETURNING id,bg_client_id,link_status INTO row;
 INSERT INTO shared_results VALUES('creative inherits client-only pipeline',row.bg_client_id=a AND row.link_status='linked');
 INSERT INTO sessions(user_id,brand_name,brief_text,stage_16_vision_output) VALUES('00000000-0000-4000-8000-000000000002','Legacy','Unchanged brief','Unchanged document') RETURNING id INTO r;
 BEGIN PERFORM public.bg_admin_attach_client('sessions',r,a); INSERT INTO shared_results VALUES('non-admin attachment denied',false);
 EXCEPTION WHEN raise_exception THEN INSERT INTO shared_results VALUES('non-admin attachment denied',true); END;
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
 t:=public.bg_admin_attach_client('sessions',r,a);
 INSERT INTO shared_results VALUES('admin attaches legacy client without engagement',t='linked' AND EXISTS(SELECT 1 FROM sessions WHERE id=r AND bg_client_id=a AND engagement_id IS NULL));
 INSERT INTO shared_results VALUES('attachment leaves brief and document untouched',EXISTS(SELECT 1 FROM sessions WHERE id=r AND brief_text='Unchanged brief' AND stage_16_vision_output='Unchanged document'));
 BEGIN PERFORM public.bg_admin_attach_client('sessions',r,c); INSERT INTO shared_results VALUES('attachment cannot overwrite existing client',false);
 EXCEPTION WHEN raise_exception THEN INSERT INTO shared_results VALUES('attachment cannot overwrite existing client',true); END;
 INSERT INTO shared_results VALUES('attachment records admin actor once',(SELECT count(*)=1 FROM bg_link_events WHERE run_id=r AND linked_by='00000000-0000-4000-8000-000000000001'));
END $$;
DO $$ DECLARE t text; r record; c uuid;
BEGIN
 SELECT bg_client_id INTO c FROM public.bg_shared_clients() WHERE hub_client_id='shared-test-a';
 FOREACH t IN ARRAY ARRAY['synthesiser_runs','intelligence_sessions','briefing_room_workspaces','sessions','saved_briefs','stimulus_runs'] LOOP
 EXECUTE format('INSERT INTO public.%I(user_id,created_by,brand_name,hub_client) VALUES($1,$1,$2,$3) RETURNING bg_client_id,engagement_id,link_status',t)
 INTO r USING '00000000-0000-4000-8000-000000000002'::uuid,'Unrelated brand','shared-test-a';
 INSERT INTO shared_results VALUES(t || ' trigger links client only',r.bg_client_id=c AND r.engagement_id IS NULL AND r.link_status='linked');
 END LOOP;
END $$;
SELECT name, CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result FROM shared_results;
GRANT ALL ON shared_results TO authenticated;
SET LOCAL ROLE authenticated;
DO $$ DECLARE c uuid; r uuid; st text; cid uuid;
BEGIN
 SELECT client_id INTO c FROM public.bg_lookup_hub_client('shared-test-a');
 INSERT INTO sessions(user_id,brand_name,bg_client_id,link_status) VALUES(auth.uid(),'Marlowe Motor Company',c,'linked') RETURNING id,link_status,bg_client_id INTO r,st,cid;
 INSERT INTO shared_results VALUES('browser direct link IDs are stripped',st='unlinked' AND cid IS NULL);
 UPDATE sessions SET bg_client_id=c,link_status='linked' WHERE id=r RETURNING link_status,bg_client_id INTO st,cid;
 INSERT INTO shared_results VALUES('browser cannot overwrite link fields',st='unlinked' AND cid IS NULL);
 INSERT INTO sessions(user_id,brand_name,hub_client) VALUES(auth.uid(),'Unrelated name','shared-test-a') RETURNING link_status,bg_client_id INTO st,cid;
 INSERT INTO shared_results VALUES('authenticated Hub insertion resolves client only',st='linked' AND cid=c);
END $$;
RESET ROLE;
SELECT name,CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END result FROM shared_results WHERE name LIKE 'browser%' OR name LIKE 'authenticated%';
DO $$ BEGIN IF EXISTS(SELECT 1 FROM shared_results WHERE NOT ok) THEN RAISE EXCEPTION 'Shared client database checks failed'; END IF; END $$;
ROLLBACK;