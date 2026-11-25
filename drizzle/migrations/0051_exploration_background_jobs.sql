CREATE TABLE public.bg_exploration_jobs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),session_id uuid NOT NULL UNIQUE REFERENCES public.sessions(id),status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','complete','failed')),wake_token uuid NOT NULL DEFAULT gen_random_uuid(),lease_token uuid,lease_until timestamptz,error text,created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.bg_exploration_jobs TO authenticated; GRANT ALL ON public.bg_exploration_jobs TO service_role;
ALTER TABLE public.bg_exploration_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY exploration_job_read ON public.bg_exploration_jobs FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.sessions s WHERE s.id=session_id AND (s.user_id=auth.uid() OR public.bg_is_admin(auth.uid()))));
CREATE TABLE public.bg_exploration_attempts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),job_id uuid NOT NULL REFERENCES public.bg_exploration_jobs(id),attempt integer NOT NULL,raw_output text,error text,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(job_id,attempt));
GRANT SELECT ON public.bg_exploration_attempts TO authenticated; GRANT SELECT,INSERT ON public.bg_exploration_attempts TO service_role;
ALTER TABLE public.bg_exploration_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY exploration_attempt_read ON public.bg_exploration_attempts FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.bg_exploration_jobs j WHERE j.id=job_id));
CREATE TRIGGER exploration_attempt_immutable BEFORE UPDATE OR DELETE ON public.bg_exploration_attempts FOR EACH ROW EXECUTE FUNCTION public.bg_projection_append_only();
CREATE FUNCTION public.bg_exploration_queue_on_completion() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.exploration_brief IS NOT NULL AND NEW.stage_13_output IS NOT NULL AND OLD.stage_13_output IS NULL THEN
 IF NOT (NEW.checkpoint_a_confirmed AND NEW.checkpoint_b_confirmed AND NEW.checkpoint_c_confirmed) THEN RAISE EXCEPTION 'EXPLORATION_CHECKPOINT_NOT_CONFIRMED'; END IF;
 INSERT INTO public.bg_exploration_jobs(session_id) VALUES(NEW.id) ON CONFLICT(session_id) DO NOTHING;
 END IF; RETURN NEW;
 END $$;
CREATE TRIGGER exploration_completion_queue AFTER UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.bg_exploration_queue_on_completion();
CREATE FUNCTION public.bg_projection_wake() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.status='queued' THEN PERFORM net.http_post(url:='https://brandgrenade.app/api/public/projection-tick',headers:=jsonb_build_object('Content-Type','application/json','x-projection-token',NEW.wake_token::text),body:=jsonb_build_object('jobId',NEW.id),timeout_milliseconds:=1200000); END IF; RETURN NEW; END $$;
CREATE TRIGGER projection_job_wake AFTER INSERT ON public.bg_projection_jobs FOR EACH ROW EXECUTE FUNCTION public.bg_projection_wake();
CREATE FUNCTION public.bg_exploration_wake() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.status='queued' THEN PERFORM net.http_post(url:='https://brandgrenade.app/api/public/exploration-tick',headers:=jsonb_build_object('Content-Type','application/json','x-exploration-token',NEW.wake_token::text),body:=jsonb_build_object('jobId',NEW.id),timeout_milliseconds:=1200000); END IF; RETURN NEW; END $$;
CREATE TRIGGER exploration_job_wake AFTER INSERT ON public.bg_exploration_jobs FOR EACH ROW EXECUTE FUNCTION public.bg_exploration_wake();