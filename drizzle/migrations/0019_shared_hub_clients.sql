ALTER TABLE public.saved_briefs ADD COLUMN IF NOT EXISTS hub_client text, ADD COLUMN IF NOT EXISTS hub_job text, ADD COLUMN IF NOT EXISTS hub_ctx text;
CREATE OR REPLACE FUNCTION public.bg_resolve_hub(_client text, _job text, OUT bg_client_id uuid, OUT engagement_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE c uuid; e uuid;
BEGIN
 IF _client IS NULL THEN RETURN; END IF;
 SELECT x.bg_client_id INTO c FROM public.bg_external_ids x WHERE x.system='hub_client' AND x.external_id=_client;
 IF c IS NULL THEN RETURN; END IF;
 IF _job IS NOT NULL THEN
  SELECT x.engagement_id INTO e FROM public.bg_external_ids x WHERE x.system='hub_job' AND x.external_id=_job AND x.bg_client_id=c;
  IF e IS NULL THEN RETURN; END IF;
 END IF;
 bg_client_id:=c; engagement_id:=e;
END $$;
REVOKE ALL ON FUNCTION public.bg_resolve_hub(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bg_resolve_hub(text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.bg_shared_clients()
RETURNS TABLE(bg_client_id uuid, hub_client_id text, name text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT c.id,x.external_id,c.name,c.created_at FROM public.bg_clients c LEFT JOIN public.bg_external_ids x ON x.bg_client_id=c.id AND x.system='hub_client' ORDER BY c.created_at,c.id
$$;
REVOKE ALL ON FUNCTION public.bg_shared_clients() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bg_shared_clients() TO service_role;
CREATE OR REPLACE FUNCTION public.bg_ensure_client(_hub_client_id text,_name text)
RETURNS TABLE(bg_client_id uuid,hub_client_id text,name text,created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cid uuid;
BEGIN
 IF _hub_client_id IS NULL OR btrim(_hub_client_id)='' OR length(_hub_client_id)>200 OR _name IS NULL OR btrim(_name)='' OR length(_name)>200 THEN RAISE EXCEPTION 'Invalid client'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('bg_hub_client:' || btrim(_hub_client_id),0));
 SELECT x.bg_client_id INTO cid FROM public.bg_external_ids x WHERE x.system='hub_client' AND x.external_id=btrim(_hub_client_id);
 IF cid IS NULL THEN
  INSERT INTO public.bg_clients(name) VALUES(btrim(_name)) RETURNING id INTO cid;
  INSERT INTO public.bg_external_ids(bg_client_id,system,external_id) VALUES(cid,'hub_client',btrim(_hub_client_id));
 END IF;
 RETURN QUERY SELECT c.id,btrim(_hub_client_id),c.name,c.created_at FROM public.bg_clients c WHERE c.id=cid;
END $$;
REVOKE ALL ON FUNCTION public.bg_ensure_client(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bg_ensure_client(text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.bg_lookup_hub_client(_hub_client_id text)
RETURNS TABLE(client_id uuid,client_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT c.id,c.name FROM public.bg_clients c JOIN public.bg_external_ids x ON x.bg_client_id=c.id WHERE auth.uid() IS NOT NULL AND x.system='hub_client' AND x.external_id=_hub_client_id
$$;
REVOKE ALL ON FUNCTION public.bg_lookup_hub_client(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bg_lookup_hub_client(text) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.bg_run_link() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE
 j jsonb:=to_jsonb(NEW);
 unpriv boolean:=current_user IN ('authenticated','anon');
 src uuid; owner uuid; r record; hub_changed boolean:=false;
BEGIN
 owner:=coalesce((j->>'user_id')::uuid,(j->>'created_by')::uuid);
 src:=CASE WHEN TG_TABLE_NAME='stimulus_runs' THEN (j->>'session_id')::uuid ELSE (j->>'bg_source_id')::uuid END;
 IF TG_OP='INSERT' THEN
  IF unpriv THEN NEW.bg_client_id:=NULL; NEW.engagement_id:=NULL; END IF;
  IF NEW.bg_client_id IS NULL AND src IS NOT NULL THEN
   SELECT * INTO r FROM public.bg_source_link(TG_TABLE_NAME,src,owner);
   NEW.bg_client_id:=r.bg_client_id; NEW.engagement_id:=r.engagement_id;
  END IF;
  IF NEW.bg_client_id IS NULL AND j ? 'hub_client' THEN
   SELECT * INTO r FROM public.bg_resolve_hub(j->>'hub_client',j->>'hub_job');
   NEW.bg_client_id:=r.bg_client_id; NEW.engagement_id:=r.engagement_id;
  END IF;
  NEW.link_status:=CASE WHEN NEW.bg_client_id IS NOT NULL THEN 'linked' ELSE 'unlinked' END;
  RETURN NEW;
 END IF;
 IF unpriv THEN
  NEW.bg_client_id:=OLD.bg_client_id; NEW.engagement_id:=OLD.engagement_id; NEW.link_status:=OLD.link_status;
 END IF;
 IF j ? 'hub_client' THEN
  hub_changed:=(j->>'hub_client') IS DISTINCT FROM (to_jsonb(OLD)->>'hub_client') OR (j->>'hub_job') IS DISTINCT FROM (to_jsonb(OLD)->>'hub_job');
 END IF;
 IF hub_changed AND NEW.bg_client_id IS NULL AND OLD.link_status='unlinked' THEN
  SELECT * INTO r FROM public.bg_resolve_hub(j->>'hub_client',j->>'hub_job');
  NEW.bg_client_id:=r.bg_client_id; NEW.engagement_id:=r.engagement_id;
 END IF;
 IF NEW.bg_client_id IS DISTINCT FROM OLD.bg_client_id OR NEW.engagement_id IS DISTINCT FROM OLD.engagement_id THEN
  IF NEW.engagement_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.bg_engagements e WHERE e.id=NEW.engagement_id AND e.bg_client_id=NEW.bg_client_id) THEN RAISE EXCEPTION 'Engagement belongs to a different client'; END IF;
  NEW.link_status:=CASE WHEN NEW.bg_client_id IS NOT NULL THEN 'linked' WHEN OLD.link_status='legacy' THEN 'legacy' ELSE 'unlinked' END;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.bg_admin_attach_client(_table text,_run_id uuid,_client uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE prev text; cid uuid; idcol text; next_status text;
BEGIN
 IF NOT public.bg_is_admin(auth.uid()) THEN RAISE EXCEPTION 'Only admins can attach clients'; END IF;
 IF _table NOT IN ('synthesiser_runs','intelligence_sessions','briefing_room_workspaces','saved_briefs','sessions','stimulus_runs') THEN RAISE EXCEPTION 'Unknown Room table'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.bg_clients WHERE id=_client) THEN RAISE EXCEPTION 'Client not found'; END IF;
 idcol:=CASE WHEN _table='saved_briefs' THEN 'brief_id' ELSE 'id' END;
 EXECUTE format('SELECT link_status,bg_client_id FROM public.%I WHERE %I=$1 FOR UPDATE',_table,idcol) INTO prev,cid USING _run_id;
 IF prev IS NULL THEN RAISE EXCEPTION 'Run not found'; END IF;
 IF cid IS NOT NULL OR prev='linked' THEN RAISE EXCEPTION 'Client already attached'; END IF;
 EXECUTE format('UPDATE public.%I SET bg_client_id=$1,engagement_id=NULL WHERE %I=$2 RETURNING link_status',_table,idcol) INTO next_status USING _client,_run_id;
 INSERT INTO public.bg_link_events(run_table,run_id,bg_client_id,from_status,to_status,source,linked_by) VALUES(_table,_run_id,_client,prev,next_status,'admin_client_attach',auth.uid());
 RETURN next_status;
END $$;
REVOKE ALL ON FUNCTION public.bg_admin_attach_client(text,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bg_admin_attach_client(text,uuid,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.bg_client_options()
RETURNS TABLE(client_id uuid,client_name text,engagement_id uuid,engagement_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT c.id,c.name,e.id,e.name FROM public.bg_clients c LEFT JOIN public.bg_engagements e ON e.bg_client_id=c.id WHERE public.bg_is_admin(auth.uid()) ORDER BY c.name,e.name
$$;
REVOKE ALL ON FUNCTION public.bg_client_options() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bg_client_options() TO authenticated;