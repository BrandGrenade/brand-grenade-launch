ALTER TABLE public.bg_exploration_jobs ADD COLUMN projection_jobs jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE OR REPLACE FUNCTION public.bg_projection_wake() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.status='queued' THEN PERFORM net.http_post(url:='https://brandgrenade.app/api/public/projection-tick',headers:=jsonb_build_object('Content-Type','application/json','x-projection-token',NEW.wake_token::text),body:=jsonb_build_object('jobId',NEW.id),timeout_milliseconds:=1200000); END IF; RETURN NEW; END $$;
CREATE TRIGGER projection_job_rewake AFTER UPDATE OF status ON public.bg_projection_jobs FOR EACH ROW WHEN (NEW.status='queued') EXECUTE FUNCTION public.bg_projection_wake();
CREATE TRIGGER exploration_job_rewake AFTER UPDATE OF status ON public.bg_exploration_jobs FOR EACH ROW WHEN (NEW.status='queued') EXECUTE FUNCTION public.bg_exploration_wake();
CREATE FUNCTION public.bg_publish_projection(_job uuid,_lease uuid,_output jsonb,_method text,_prompt text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE j public.bg_projection_jobs; r uuid; BEGIN
 SELECT * INTO j FROM public.bg_projection_jobs WHERE id=_job FOR UPDATE;
 IF j.status<>'running' OR j.lease_token IS DISTINCT FROM _lease OR j.lease_until<now() THEN RAISE EXCEPTION 'PROJECTION_LEASE_LOST'; END IF;
 INSERT INTO public.bg_modelled_projections(job_id,baseline_job_id,baseline_version,output,method_version,scorer_prompt_version) VALUES(j.id,j.baseline_job_id,(j.baseline_snapshot->>'version')::int,_output,_method,_prompt) RETURNING id INTO r;
 UPDATE public.bg_projection_jobs SET status='complete',lease_until=NULL,error=NULL WHERE id=j.id; RETURN r; END $$;
REVOKE ALL ON FUNCTION public.bg_publish_projection(uuid,uuid,jsonb,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bg_publish_projection(uuid,uuid,jsonb,text,text) TO service_role;
CREATE FUNCTION public.bg_publish_exploration(_job uuid,_lease uuid,_baseline uuid,_version int,_outputs jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE j public.bg_exploration_jobs; r uuid; BEGIN
 SELECT * INTO j FROM public.bg_exploration_jobs WHERE id=_job FOR UPDATE;
 IF j.status<>'running' OR j.lease_token IS DISTINCT FROM _lease OR j.lease_until<now() THEN RAISE EXCEPTION 'EXPLORATION_LEASE_LOST'; END IF;
 INSERT INTO public.bg_exploration_assessments(session_id,baseline_job_id,run_version,outputs) VALUES(j.session_id,_baseline,_version,_outputs) RETURNING id INTO r;
 UPDATE public.bg_exploration_jobs SET status='complete',lease_until=NULL,error=NULL WHERE id=j.id; RETURN r; END $$;
REVOKE ALL ON FUNCTION public.bg_publish_exploration(uuid,uuid,uuid,int,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bg_publish_exploration(uuid,uuid,uuid,int,jsonb) TO service_role;