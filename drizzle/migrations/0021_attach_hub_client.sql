CREATE OR REPLACE FUNCTION public.bg_attach_client(_bg_client_id uuid,_hub_client_id text)
RETURNS TABLE(bg_client_id uuid,hub_client_id text,name text,created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c record; existing uuid;
BEGIN
 IF _bg_client_id IS NULL OR _hub_client_id IS NULL OR btrim(_hub_client_id)='' OR length(_hub_client_id)>200 THEN RAISE EXCEPTION 'Invalid client'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('bg_hub_client:' || btrim(_hub_client_id),0));
 SELECT * INTO c FROM public.bg_clients WHERE id=_bg_client_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
 SELECT x.bg_client_id INTO existing FROM public.bg_external_ids x WHERE x.system='hub_client' AND x.external_id=btrim(_hub_client_id);
 IF existing IS NOT NULL AND existing<>_bg_client_id THEN RAISE EXCEPTION 'hub_id_attached'; END IF;
 IF EXISTS (SELECT 1 FROM public.bg_external_ids x WHERE x.system='hub_client' AND x.bg_client_id=_bg_client_id AND x.external_id<>btrim(_hub_client_id)) THEN RAISE EXCEPTION 'bg_client_attached'; END IF;
 IF existing IS NULL THEN INSERT INTO public.bg_external_ids(bg_client_id,system,external_id) VALUES(_bg_client_id,'hub_client',btrim(_hub_client_id)); END IF;
 RETURN QUERY SELECT c.id,btrim(_hub_client_id),c.name,c.created_at;
END $$;
REVOKE ALL ON FUNCTION public.bg_attach_client(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bg_attach_client(uuid,text) TO service_role;