-- Let any signed-in user list client/engagement names for the start-form picker,
-- and link a run they own at creation time. Links stay database-controlled:
-- this function is the only user path, mirroring bg_admin_link_run's checks.

CREATE OR REPLACE FUNCTION public.bg_client_options()
RETURNS TABLE(client_id uuid, client_name text, engagement_id uuid, engagement_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.name, e.id, e.name
  FROM public.bg_clients c
  LEFT JOIN public.bg_engagements e ON e.bg_client_id = c.id
  ORDER BY c.name, e.name
$$;
REVOKE EXECUTE ON FUNCTION public.bg_client_options() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bg_client_options() TO authenticated;

CREATE OR REPLACE FUNCTION public.bg_user_link_run(_table text, _run_id uuid, _client uuid, _engagement uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prev text; next_status text; idcol text; owner uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF _table NOT IN ('synthesiser_runs','intelligence_sessions','briefing_room_workspaces','saved_briefs','sessions','stimulus_runs') THEN
    RAISE EXCEPTION 'Unknown Room table';
  END IF;
  IF _client IS NULL OR _engagement IS NULL THEN RAISE EXCEPTION 'Choose a client and an engagement'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bg_engagements e WHERE e.id = _engagement AND e.bg_client_id = _client) THEN
    RAISE EXCEPTION 'Engagement belongs to a different client';
  END IF;
  idcol := CASE WHEN _table = 'saved_briefs' THEN 'brief_id' ELSE 'id' END;
  EXECUTE format('SELECT link_status, coalesce(user_id, created_by) FROM public.%I WHERE %I = $1', _table, idcol)
    INTO prev, owner USING _run_id;
  IF prev IS NULL THEN RAISE EXCEPTION 'Run not found'; END IF;
  IF owner IS DISTINCT FROM auth.uid() AND NOT public.bg_is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'You can only link your own runs';
  END IF;
  IF prev <> 'unlinked' THEN RAISE EXCEPTION 'Run is already linked'; END IF;
  EXECUTE format('UPDATE public.%I SET bg_client_id = $1, engagement_id = $2 WHERE %I = $3 RETURNING link_status', _table, idcol)
    INTO next_status USING _client, _engagement, _run_id;
  INSERT INTO public.bg_link_events(run_table, run_id, bg_client_id, engagement_id, from_status, to_status, source, linked_by)
  VALUES (_table, _run_id, _client, _engagement, prev, next_status, 'user_picker', auth.uid());
  RETURN next_status;
END $$;
REVOKE EXECUTE ON FUNCTION public.bg_user_link_run(text, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bg_user_link_run(text, uuid, uuid, uuid) TO authenticated;