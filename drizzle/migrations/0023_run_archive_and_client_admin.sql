
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS archived_at timestamptz, ADD COLUMN IF NOT EXISTS archived_by uuid;
ALTER TABLE public.briefing_room_workspaces ADD COLUMN IF NOT EXISTS archived_at timestamptz, ADD COLUMN IF NOT EXISTS archived_by uuid;
ALTER TABLE public.intelligence_sessions ADD COLUMN IF NOT EXISTS archived_at timestamptz, ADD COLUMN IF NOT EXISTS archived_by uuid;
ALTER TABLE public.synthesiser_runs ADD COLUMN IF NOT EXISTS archived_at timestamptz, ADD COLUMN IF NOT EXISTS archived_by uuid;
ALTER TABLE public.stimulus_runs ADD COLUMN IF NOT EXISTS archived_at timestamptz, ADD COLUMN IF NOT EXISTS archived_by uuid;
ALTER TABLE public.bg_clients ADD COLUMN IF NOT EXISTS archived_at timestamptz, ADD COLUMN IF NOT EXISTS archived_by uuid;

-- Archive fields change only through the RPCs below (owner/admin archive, admin restore).
CREATE OR REPLACE FUNCTION public.bg_archive_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated','anon') AND
     (NEW.archived_at IS DISTINCT FROM OLD.archived_at OR NEW.archived_by IS DISTINCT FROM OLD.archived_by) THEN
    RAISE EXCEPTION 'Archive state can only change through Archive run or Admin restore.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.bg_archive_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS bg_archive_guard ON public.sessions;
CREATE TRIGGER bg_archive_guard BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.bg_archive_guard();
DROP TRIGGER IF EXISTS bg_archive_guard ON public.briefing_room_workspaces;
CREATE TRIGGER bg_archive_guard BEFORE UPDATE ON public.briefing_room_workspaces FOR EACH ROW EXECUTE FUNCTION public.bg_archive_guard();
DROP TRIGGER IF EXISTS bg_archive_guard ON public.intelligence_sessions;
CREATE TRIGGER bg_archive_guard BEFORE UPDATE ON public.intelligence_sessions FOR EACH ROW EXECUTE FUNCTION public.bg_archive_guard();
DROP TRIGGER IF EXISTS bg_archive_guard ON public.synthesiser_runs;
CREATE TRIGGER bg_archive_guard BEFORE UPDATE ON public.synthesiser_runs FOR EACH ROW EXECUTE FUNCTION public.bg_archive_guard();
DROP TRIGGER IF EXISTS bg_archive_guard ON public.stimulus_runs;
CREATE TRIGGER bg_archive_guard BEFORE UPDATE ON public.stimulus_runs FOR EACH ROW EXECUTE FUNCTION public.bg_archive_guard();
DROP TRIGGER IF EXISTS bg_archive_guard ON public.bg_clients;
CREATE TRIGGER bg_archive_guard BEFORE UPDATE ON public.bg_clients FOR EACH ROW EXECUTE FUNCTION public.bg_archive_guard();

-- Archive (owner or admin) or restore (admin only) exactly one run. Never deletes.
CREATE OR REPLACE FUNCTION public.bg_set_run_archived(_table text, _run_id uuid, _archived boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); owner uuid; admin boolean; n integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501'; END IF;
  IF _table NOT IN ('sessions','briefing_room_workspaces','intelligence_sessions','synthesiser_runs','stimulus_runs') THEN
    RAISE EXCEPTION 'Unknown run table' USING ERRCODE = '22023';
  END IF;
  admin := public.bg_is_admin(uid);
  IF _table = 'stimulus_runs' THEN
    SELECT s.user_id INTO owner FROM public.stimulus_runs r JOIN public.sessions s ON s.id = r.session_id WHERE r.id = _run_id;
  ELSE
    EXECUTE format('SELECT user_id FROM public.%I WHERE id = $1', _table) INTO owner USING _run_id;
  END IF;
  IF owner IS NULL AND NOT admin THEN RAISE EXCEPTION 'Run not found' USING ERRCODE = 'P0002'; END IF;
  IF _archived THEN
    IF NOT admin AND owner IS DISTINCT FROM uid THEN RAISE EXCEPTION 'Run not found' USING ERRCODE = 'P0002'; END IF;
    EXECUTE format('UPDATE public.%I SET archived_at = now(), archived_by = $2 WHERE id = $1 AND archived_at IS NULL', _table) USING _run_id, uid;
  ELSE
    IF NOT admin THEN RAISE EXCEPTION 'Only an admin can restore a run.' USING ERRCODE = '42501'; END IF;
    EXECUTE format('UPDATE public.%I SET archived_at = NULL, archived_by = NULL WHERE id = $1 AND archived_at IS NOT NULL', _table) USING _run_id;
  END IF;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN CASE WHEN n = 1 THEN (CASE WHEN _archived THEN 'archived' ELSE 'restored' END) ELSE 'unchanged' END;
END $$;
REVOKE ALL ON FUNCTION public.bg_set_run_archived(text, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bg_set_run_archived(text, uuid, boolean) TO authenticated, service_role;

-- Admin: how many jobs and runs a client holds (shown in the confirmation).
CREATE OR REPLACE FUNCTION public.bg_client_holdings(_client uuid)
RETURNS TABLE(client_name text, jobs integer, runs integer, archived_runs integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE t text; c integer; a integer; tot integer := 0; arc integer := 0;
BEGIN
  IF NOT public.bg_is_admin(auth.uid()) THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501'; END IF;
  FOREACH t IN ARRAY ARRAY['sessions','briefing_room_workspaces','intelligence_sessions','synthesiser_runs','stimulus_runs'] LOOP
    EXECUTE format('SELECT count(*), count(*) FILTER (WHERE archived_at IS NOT NULL) FROM public.%I WHERE bg_client_id = $1', t) INTO c, a USING _client;
    tot := tot + c; arc := arc + a;
  END LOOP;
  RETURN QUERY SELECT bc.name, (SELECT count(*)::int FROM public.bg_engagements e WHERE e.bg_client_id = _client), tot, arc
    FROM public.bg_clients bc WHERE bc.id = _client;
END $$;
REVOKE ALL ON FUNCTION public.bg_client_holdings(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bg_client_holdings(uuid) TO authenticated, service_role;

-- Admin: archive a whole client (client + every run it holds) or delete an empty client.
-- The typed name must match exactly. Clients that hold runs are never deleted.
CREATE OR REPLACE FUNCTION public.bg_admin_remove_client(_client uuid, _confirm_name text, _mode text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); nm text; t text; held integer := 0; c integer;
BEGIN
  IF NOT public.bg_is_admin(uid) THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501'; END IF;
  SELECT name INTO nm FROM public.bg_clients WHERE id = _client FOR UPDATE;
  IF nm IS NULL THEN RAISE EXCEPTION 'Client not found' USING ERRCODE = 'P0002'; END IF;
  IF _confirm_name IS DISTINCT FROM nm THEN RAISE EXCEPTION 'Type the client name exactly to confirm.' USING ERRCODE = '22023'; END IF;
  IF _mode = 'archive' THEN
    FOREACH t IN ARRAY ARRAY['sessions','briefing_room_workspaces','intelligence_sessions','synthesiser_runs','stimulus_runs'] LOOP
      EXECUTE format('UPDATE public.%I SET archived_at = now(), archived_by = $2 WHERE bg_client_id = $1 AND archived_at IS NULL', t) USING _client, uid;
    END LOOP;
    UPDATE public.bg_clients SET archived_at = now(), archived_by = uid WHERE id = _client AND archived_at IS NULL;
    RETURN 'archived';
  ELSIF _mode = 'delete' THEN
    FOREACH t IN ARRAY ARRAY['sessions','briefing_room_workspaces','intelligence_sessions','synthesiser_runs','stimulus_runs','saved_briefs'] LOOP
      EXECUTE format('SELECT count(*) FROM public.%I WHERE bg_client_id = $1', t) INTO c USING _client;
      held := held + c;
    END LOOP;
    IF held > 0 THEN RAISE EXCEPTION 'This client holds % run(s) or brief(s); archive it instead. Runs are never deleted.', held USING ERRCODE = 'P0001'; END IF;
    DELETE FROM public.bg_external_ids WHERE bg_client_id = _client;
    DELETE FROM public.bg_engagements WHERE bg_client_id = _client;
    DELETE FROM public.bg_clients WHERE id = _client;
    RETURN 'deleted';
  END IF;
  RAISE EXCEPTION 'Unknown mode' USING ERRCODE = '22023';
END $$;
REVOKE ALL ON FUNCTION public.bg_admin_remove_client(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bg_admin_remove_client(uuid, text, text) TO authenticated, service_role;

-- Client and job names for runs the caller owns (admins: all). Names only; no run access.
CREATE OR REPLACE FUNCTION public.bg_run_group_names()
RETURNS TABLE(client_id uuid, client_name text, engagement_id uuid, engagement_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH mine AS (
    SELECT bg_client_id c, engagement_id e FROM public.sessions WHERE user_id = auth.uid()
    UNION SELECT bg_client_id, engagement_id FROM public.briefing_room_workspaces WHERE user_id = auth.uid()
    UNION SELECT bg_client_id, engagement_id FROM public.intelligence_sessions WHERE user_id = auth.uid()
    UNION SELECT bg_client_id, engagement_id FROM public.synthesiser_runs WHERE user_id = auth.uid()
    UNION SELECT r.bg_client_id, r.engagement_id FROM public.stimulus_runs r JOIN public.sessions s ON s.id = r.session_id WHERE s.user_id = auth.uid()
    UNION SELECT bg_client_id, engagement_id FROM public.saved_briefs WHERE user_id = auth.uid()
  )
  SELECT c.id, c.name, e.id, e.name FROM public.bg_clients c
  LEFT JOIN public.bg_engagements e ON e.bg_client_id = c.id
  WHERE auth.uid() IS NOT NULL AND (public.bg_is_admin(auth.uid())
     OR c.id IN (SELECT m.c FROM mine m WHERE m.c IS NOT NULL))
$$;
REVOKE ALL ON FUNCTION public.bg_run_group_names() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bg_run_group_names() TO authenticated, service_role;

CREATE OR REPLACE VIEW public.brand_register_sessions WITH (security_invoker = true) AS
SELECT s.id, s.brand_name, s.category, s.status, s.current_stage, s.created_at, s.updated_at,
  s.phase_2_status, s.stage_status, s.interrupted_stage, s.last_heartbeat_at, s.is_preflight_test,
  (s.stage_16_consulting_output IS NOT NULL) AS has_stage_16_consulting,
  (s.stage_17_output IS NOT NULL) AS has_stage_17,
  (s.stage_22_output IS NOT NULL) AS has_stage_22,
  s.bg_client_id, s.engagement_id, s.brief_type, s.run_mode, s.archived_at
FROM public.sessions s;

CREATE OR REPLACE VIEW public.brand_register_briefings WITH (security_invoker = true) AS
SELECT w.id, w.brand_name, w.category, w.status, w.created_at, w.updated_at, w.selected_tension_index,
  (w.diagnosis IS NOT NULL) AS has_diagnosis, (w.truths IS NOT NULL) AS has_truths,
  (w.relevance IS NOT NULL) AS has_relevance, (w.tensions IS NOT NULL) AS has_tensions,
  w.bg_client_id, w.engagement_id, w.archived_at
FROM public.briefing_room_workspaces w;
