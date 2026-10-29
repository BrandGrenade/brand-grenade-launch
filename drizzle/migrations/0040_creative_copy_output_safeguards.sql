ALTER TABLE public.stimulus_prompts ADD COLUMN IF NOT EXISTS output_revision integer NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS repair_snapshot jsonb, ADD COLUMN IF NOT EXISTS required_exact_sentences jsonb NOT NULL DEFAULT '[]', ADD COLUMN IF NOT EXISTS preserved_fields jsonb NOT NULL DEFAULT '{}', ADD COLUMN IF NOT EXISTS worker_token uuid, ADD COLUMN IF NOT EXISTS worker_lease_until timestamptz;
CREATE OR REPLACE FUNCTION public.bg_copy_prompt_output_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE stamp text := clock_timestamp()::text; resolutions jsonb; prior jsonb;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.stimulus_orchestrations o JOIN public.sessions s ON s.id=o.session_id WHERE o.id=NEW.orchestration_id AND s.id='cb7ac9d6-f70b-4902-beb6-7bd0ff5da85f' AND s.test_copy_of IS NOT NULL) THEN RETURN NEW; END IF;
 IF ROW(NEW.initial_prompt,NEW.working_prompt,NEW.final_prompt) IS DISTINCT FROM ROW(OLD.initial_prompt,OLD.working_prompt,OLD.final_prompt) THEN
   NEW.output_revision := OLD.output_revision+1;
   SELECT coalesce(jsonb_agg(CASE WHEN r->>'action'='approved_with_issue' AND coalesce(r->>'superseded_at','')='' THEN r || jsonb_build_object('superseded_at',stamp,'superseded_by_revision',NEW.output_revision) ELSE r END),'[]'::jsonb) INTO resolutions FROM jsonb_array_elements(coalesce(OLD.issue_resolutions,'[]')) r;
   NEW.issue_resolutions := resolutions;
   prior := jsonb_build_object('kind','output_superseded','at',stamp,'revision',OLD.output_revision,'before',to_jsonb(OLD));
   NEW.revision_log := coalesce(NEW.revision_log,'[]') || jsonb_build_array(prior);
   NEW.gate_two_approved:=false; NEW.gate_two_approved_at:=NULL; NEW.gate_two_snapshot:=NULL;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER bg_copy_prompt_output_guard BEFORE UPDATE ON public.stimulus_prompts FOR EACH ROW EXECUTE FUNCTION public.bg_copy_prompt_output_guard();
CREATE OR REPLACE FUNCTION public.bg_claim_creative_prompt(p_id uuid,p_token uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer;
BEGIN
 UPDATE public.stimulus_prompts SET worker_token=p_token,worker_lease_until=clock_timestamp()+interval '10 minutes',run_state='running' WHERE id=p_id AND (worker_lease_until IS NULL OR worker_lease_until<clock_timestamp());
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n=1;
END $$;
REVOKE ALL ON FUNCTION public.bg_claim_creative_prompt(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bg_claim_creative_prompt(uuid,uuid) TO service_role;