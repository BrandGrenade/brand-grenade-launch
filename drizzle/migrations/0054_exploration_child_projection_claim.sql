CREATE FUNCTION public.bg_exploration_projection(_job uuid,_lease uuid,_key text,_client uuid,_baseline jsonb,_change jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE j public.bg_exploration_jobs; p uuid; BEGIN
 SELECT * INTO j FROM public.bg_exploration_jobs WHERE id=_job FOR UPDATE;
 IF j.status<>'running' OR j.lease_token IS DISTINCT FROM _lease OR j.lease_until<now() THEN RAISE EXCEPTION 'EXPLORATION_LEASE_LOST'; END IF;
 IF j.projection_jobs ? _key THEN RETURN (j.projection_jobs->>_key)::uuid; END IF;
 INSERT INTO public.bg_projection_jobs(bg_client_id,baseline_job_id,baseline_snapshot,proposed_change,status) VALUES(_client,(_baseline->>'job_id')::uuid,_baseline,_change,'running') RETURNING id INTO p;
 UPDATE public.bg_exploration_jobs SET projection_jobs=projection_jobs||jsonb_build_object(_key,p) WHERE id=j.id;
 RETURN p; END $$;
REVOKE ALL ON FUNCTION public.bg_exploration_projection(uuid,uuid,text,uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bg_exploration_projection(uuid,uuid,text,uuid,jsonb,jsonb) TO service_role;