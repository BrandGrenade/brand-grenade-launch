CREATE TABLE public.current_position_addon_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid NOT NULL REFERENCES public.sessions(id), source_version integer NOT NULL, published_version integer,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','complete','failed','paused')), actor_id uuid NOT NULL,
 proposition text NOT NULL, source_manifest jsonb NOT NULL, source_fingerprint text NOT NULL,
 results jsonb NOT NULL DEFAULT '{}'::jsonb, completed_stages text[] NOT NULL DEFAULT '{}', error_code text, error_message text,
 wake_token uuid NOT NULL DEFAULT gen_random_uuid(), lease_token uuid, lease_until timestamptz, heartbeat_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
 UNIQUE(session_id,source_version)
);
GRANT SELECT ON public.current_position_addon_jobs TO authenticated;
GRANT ALL ON public.current_position_addon_jobs TO service_role;
ALTER TABLE public.current_position_addon_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Existing run access reads baseline jobs" ON public.current_position_addon_jobs FOR SELECT TO authenticated USING(public.can_access_session(session_id,auth.uid()) OR public.bg_is_admin(auth.uid()));
REVOKE SELECT ON public.current_position_addon_jobs FROM authenticated;
GRANT SELECT(id,session_id,source_version,published_version,status,actor_id,proposition,source_manifest,results,completed_stages,error_code,error_message,heartbeat_at,created_at,completed_at) ON public.current_position_addon_jobs TO authenticated;
CREATE TABLE public.current_position_addon_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job_id uuid NOT NULL REFERENCES public.current_position_addon_jobs(id), stage text NOT NULL CHECK(stage IN ('10','11','13')), attempt integer NOT NULL,
 raw_output text NOT NULL DEFAULT '', result jsonb, error_code text, error_message text, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.current_position_addon_attempts TO authenticated;
GRANT ALL ON public.current_position_addon_attempts TO service_role;
ALTER TABLE public.current_position_addon_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Existing run access reads baseline attempts" ON public.current_position_addon_attempts FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.current_position_addon_jobs j WHERE j.id=job_id AND (public.can_access_session(j.session_id,auth.uid()) OR public.bg_is_admin(auth.uid()))));
CREATE OR REPLACE FUNCTION public.bg_queue_current_position_addon(_session uuid,_version integer,_actor uuid,_proposition text,_manifest jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.sessions; v integer; j uuid;
BEGIN
 SELECT * INTO s FROM public.sessions WHERE id=_session FOR UPDATE;
 IF s.id IS NULL OR NOT public.bg_is_admin(_actor) OR NOT public.can_access_session(_session,_actor) THEN RAISE EXCEPTION 'BASELINE_ACCESS_DENIED'; END IF;
 SELECT count(DISTINCT created_at)+1 INTO v FROM public.run_output_versions WHERE run_table='sessions' AND run_id=_session;
 IF v<>_version THEN RAISE EXCEPTION 'BASELINE_SOURCE_VERSION_CHANGED'; END IF;
 IF s.brief_type<>'campaign' OR s.locked_at IS NULL THEN RAISE EXCEPTION 'BASELINE_RUN_NOT_ELIGIBLE'; END IF;
 IF coalesce(length(btrim(_proposition)),0)=0 OR _manifest->>'derivation_label'<>'BG-derived' THEN RAISE EXCEPTION 'BASELINE_PROPOSITION_EVIDENCE_INSUFFICIENT'; END IF;
 INSERT INTO public.current_position_addon_jobs(session_id,source_version,actor_id,proposition,source_manifest,source_fingerprint)
 VALUES(_session,_version,_actor,_proposition,_manifest,md5(to_jsonb(s)::text)) ON CONFLICT(session_id,source_version) DO NOTHING RETURNING id INTO j;
 IF j IS NULL THEN SELECT id INTO j FROM public.current_position_addon_jobs WHERE session_id=_session AND source_version=_version; END IF;
 RETURN j;
END $$;
REVOKE ALL ON FUNCTION public.bg_queue_current_position_addon(uuid,integer,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bg_queue_current_position_addon(uuid,integer,uuid,text,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.bg_publish_current_position_addon(_job uuid,_lease uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j public.current_position_addon_jobs; s public.sessions; v integer; n text;
BEGIN
 SELECT * INTO j FROM public.current_position_addon_jobs WHERE id=_job FOR UPDATE;
 IF j.id IS NULL THEN RAISE EXCEPTION 'BASELINE_JOB_NOT_FOUND'; END IF;
 IF j.status='complete' THEN RETURN j.published_version; END IF;
 IF j.status<>'running' OR j.lease_token IS DISTINCT FROM _lease OR j.lease_until<now() THEN RAISE EXCEPTION 'BASELINE_LEASE_LOST'; END IF;
 SELECT * INTO s FROM public.sessions WHERE id=j.session_id FOR UPDATE;
 SELECT count(DISTINCT created_at)+1 INTO v FROM public.run_output_versions WHERE run_table='sessions' AND run_id=j.session_id;
 IF v<>j.source_version OR md5(to_jsonb(s)::text)<>j.source_fingerprint THEN RAISE EXCEPTION 'BASELINE_SOURCE_VERSION_CHANGED'; END IF;
 FOREACH n IN ARRAY ARRAY['10','11','13'] LOOP
 IF NOT(n=ANY(j.completed_stages)) OR j.results->n->>'status'<>'scored' OR j.results->n->>'line'<>j.proposition OR j.results->n->>'derivation_label'<>'BG-derived' OR j.results->n->>'is_current'<>'true' OR j.results->n->>'excluded_from_selection'<>'true' THEN RAISE EXCEPTION 'BASELINE_RESULT_CONTRACT_FAILED: %',n; END IF;
 END LOOP;
 INSERT INTO public.run_output_versions(run_table,run_id,field,version_no,content,reason,created_by)
 VALUES('sessions',j.session_id,'__current_position_addon_boundary',v,'null'::jsonb,'BG-derived Infiniti baseline add-on; original Campaign outputs unchanged',j.actor_id);
 UPDATE public.current_position_addon_jobs SET status='complete',published_version=v+1,completed_at=now(),lease_until=NULL,error_code=NULL,error_message=NULL WHERE id=j.id;
 RETURN v+1;
END $$;
REVOKE ALL ON FUNCTION public.bg_publish_current_position_addon(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bg_publish_current_position_addon(uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.bg_current_position_addon_wake() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status='queued' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
 PERFORM net.http_post(url:='https://brandgrenade.app/api/public/current-position-tick',headers:=jsonb_build_object('Content-Type','application/json','x-baseline-token',NEW.wake_token::text),body:=jsonb_build_object('jobId',NEW.id),timeout_milliseconds:=1200000);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.bg_current_position_addon_wake() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bg_current_position_addon_wake AFTER INSERT OR UPDATE OF status ON public.current_position_addon_jobs FOR EACH ROW EXECUTE FUNCTION public.bg_current_position_addon_wake();