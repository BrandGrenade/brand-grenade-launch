-- F1a: clients, engagements, Hub mapping, run linking, approvers, fixed status lists.
-- Additive only. No existing value is changed except new columns' defaults.

CREATE OR REPLACE FUNCTION public.bg_is_admin(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND EXISTS (SELECT 1 FROM public.users WHERE id = _uid AND is_admin = true)
$$;
REVOKE EXECUTE ON FUNCTION public.bg_is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bg_is_admin(uuid) TO authenticated, service_role;

CREATE TABLE public.bg_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (btrim(name) <> '' AND length(name) <= 200),
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.bg_clients TO authenticated;
GRANT ALL ON public.bg_clients TO service_role;
ALTER TABLE public.bg_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage clients" ON public.bg_clients FOR ALL TO authenticated
  USING (public.bg_is_admin(auth.uid())) WITH CHECK (public.bg_is_admin(auth.uid()));

CREATE TABLE public.bg_engagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bg_client_id uuid NOT NULL REFERENCES public.bg_clients(id),
  name text NOT NULL CHECK (btrim(name) <> '' AND length(name) <= 200),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bg_engagements_client_idx ON public.bg_engagements(bg_client_id);
GRANT SELECT, INSERT, UPDATE ON public.bg_engagements TO authenticated;
GRANT ALL ON public.bg_engagements TO service_role;
ALTER TABLE public.bg_engagements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage engagements" ON public.bg_engagements FOR ALL TO authenticated
  USING (public.bg_is_admin(auth.uid())) WITH CHECK (public.bg_is_admin(auth.uid()));

CREATE TABLE public.bg_external_ids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bg_client_id uuid NOT NULL REFERENCES public.bg_clients(id),
  engagement_id uuid REFERENCES public.bg_engagements(id),
  system text NOT NULL CHECK (system IN ('hub_client','hub_job','client_env')),
  external_id text NOT NULL CHECK (btrim(external_id) <> '' AND length(external_id) <= 200),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bg_external_ids_system_external_key UNIQUE (system, external_id),
  CONSTRAINT bg_external_ids_job_needs_engagement CHECK (system <> 'hub_job' OR engagement_id IS NOT NULL)
);
CREATE UNIQUE INDEX bg_external_ids_one_hub_client ON public.bg_external_ids(system, bg_client_id) WHERE system = 'hub_client';
CREATE UNIQUE INDEX bg_external_ids_one_hub_job ON public.bg_external_ids(engagement_id) WHERE system = 'hub_job';
GRANT SELECT, INSERT, UPDATE ON public.bg_external_ids TO authenticated;
GRANT ALL ON public.bg_external_ids TO service_role;
ALTER TABLE public.bg_external_ids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage external ids" ON public.bg_external_ids FOR ALL TO authenticated
  USING (public.bg_is_admin(auth.uid())) WITH CHECK (public.bg_is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.bg_external_ids_check() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.engagement_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.bg_engagements e WHERE e.id = NEW.engagement_id AND e.bg_client_id = NEW.bg_client_id) THEN
    RAISE EXCEPTION 'Engagement belongs to a different client';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER bg_external_ids_check BEFORE INSERT OR UPDATE ON public.bg_external_ids
  FOR EACH ROW EXECUTE FUNCTION public.bg_external_ids_check();

CREATE TABLE public.bg_link_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_table text NOT NULL,
  run_id uuid NOT NULL,
  bg_client_id uuid,
  engagement_id uuid,
  from_status text,
  to_status text NOT NULL,
  source text NOT NULL,
  linked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bg_link_events_run_idx ON public.bg_link_events(run_table, run_id);
GRANT SELECT ON public.bg_link_events TO authenticated;
GRANT ALL ON public.bg_link_events TO service_role;
ALTER TABLE public.bg_link_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read link events" ON public.bg_link_events FOR SELECT TO authenticated
  USING (public.bg_is_admin(auth.uid()));

ALTER TABLE public.synthesiser_runs ADD COLUMN bg_client_id uuid REFERENCES public.bg_clients(id), ADD COLUMN engagement_id uuid REFERENCES public.bg_engagements(id), ADD COLUMN link_status text NOT NULL DEFAULT 'legacy' CHECK (link_status IN ('linked','unlinked','legacy'));
ALTER TABLE public.intelligence_sessions ADD COLUMN bg_client_id uuid REFERENCES public.bg_clients(id), ADD COLUMN engagement_id uuid REFERENCES public.bg_engagements(id), ADD COLUMN link_status text NOT NULL DEFAULT 'legacy' CHECK (link_status IN ('linked','unlinked','legacy'));
ALTER TABLE public.briefing_room_workspaces ADD COLUMN bg_client_id uuid REFERENCES public.bg_clients(id), ADD COLUMN engagement_id uuid REFERENCES public.bg_engagements(id), ADD COLUMN link_status text NOT NULL DEFAULT 'legacy' CHECK (link_status IN ('linked','unlinked','legacy')), ADD COLUMN bg_source_id uuid;
ALTER TABLE public.saved_briefs ADD COLUMN bg_client_id uuid REFERENCES public.bg_clients(id), ADD COLUMN engagement_id uuid REFERENCES public.bg_engagements(id), ADD COLUMN link_status text NOT NULL DEFAULT 'legacy' CHECK (link_status IN ('linked','unlinked','legacy')), ADD COLUMN bg_source_id uuid;
ALTER TABLE public.sessions ADD COLUMN bg_client_id uuid REFERENCES public.bg_clients(id), ADD COLUMN engagement_id uuid REFERENCES public.bg_engagements(id), ADD COLUMN link_status text NOT NULL DEFAULT 'legacy' CHECK (link_status IN ('linked','unlinked','legacy')), ADD COLUMN bg_source_id uuid;
ALTER TABLE public.stimulus_runs ADD COLUMN bg_client_id uuid REFERENCES public.bg_clients(id), ADD COLUMN engagement_id uuid REFERENCES public.bg_engagements(id), ADD COLUMN link_status text NOT NULL DEFAULT 'legacy' CHECK (link_status IN ('linked','unlinked','legacy'));
ALTER TABLE public.synthesiser_runs ALTER COLUMN link_status SET DEFAULT 'unlinked';
ALTER TABLE public.intelligence_sessions ALTER COLUMN link_status SET DEFAULT 'unlinked';
ALTER TABLE public.briefing_room_workspaces ALTER COLUMN link_status SET DEFAULT 'unlinked';
ALTER TABLE public.saved_briefs ALTER COLUMN link_status SET DEFAULT 'unlinked';
ALTER TABLE public.sessions ALTER COLUMN link_status SET DEFAULT 'unlinked';
ALTER TABLE public.stimulus_runs ALTER COLUMN link_status SET DEFAULT 'unlinked';
COMMENT ON COLUMN public.briefing_room_workspaces.bg_source_id IS 'Intelligence session this workspace was created from (client/engagement inherited).';
COMMENT ON COLUMN public.saved_briefs.bg_source_id IS 'Briefing Room workspace this brief was approved from (client/engagement inherited).';
COMMENT ON COLUMN public.sessions.bg_source_id IS 'Saved brief this pipeline run was started from (client/engagement inherited).';

CREATE OR REPLACE FUNCTION public.bg_resolve_hub(_client text, _job text, OUT bg_client_id uuid, OUT engagement_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE c uuid; e uuid;
BEGIN
  IF _client IS NULL OR _job IS NULL THEN RETURN; END IF;
  SELECT x.bg_client_id INTO c FROM public.bg_external_ids x WHERE x.system = 'hub_client' AND x.external_id = _client;
  SELECT x.engagement_id INTO e FROM public.bg_external_ids x WHERE x.system = 'hub_job' AND x.external_id = _job AND x.bg_client_id = c;
  IF c IS NOT NULL AND e IS NOT NULL THEN bg_client_id := c; engagement_id := e; END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.bg_resolve_hub(text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.bg_source_link(_table text, _source uuid, _owner uuid, OUT bg_client_id uuid, OUT engagement_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _source IS NULL THEN RETURN; END IF;
  IF _table = 'stimulus_runs' THEN
    SELECT s.bg_client_id, s.engagement_id INTO bg_client_id, engagement_id FROM public.sessions s WHERE s.id = _source;
  ELSIF _table = 'briefing_room_workspaces' THEN
    SELECT s.bg_client_id, s.engagement_id INTO bg_client_id, engagement_id FROM public.intelligence_sessions s WHERE s.id = _source AND s.user_id = _owner;
  ELSIF _table = 'saved_briefs' THEN
    SELECT s.bg_client_id, s.engagement_id INTO bg_client_id, engagement_id FROM public.briefing_room_workspaces s WHERE s.id = _source AND s.user_id = _owner;
  ELSIF _table = 'sessions' THEN
    SELECT s.bg_client_id, s.engagement_id INTO bg_client_id, engagement_id FROM public.saved_briefs s WHERE s.brief_id = _source AND s.user_id = _owner;
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.bg_source_link(text, uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.bg_run_link() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  j jsonb := to_jsonb(NEW);
  unpriv boolean := current_user IN ('authenticated','anon');
  src uuid; owner uuid; r record; hub_changed boolean := false;
BEGIN
  owner := coalesce((j->>'user_id')::uuid, (j->>'created_by')::uuid);
  src := CASE WHEN TG_TABLE_NAME = 'stimulus_runs' THEN (j->>'session_id')::uuid ELSE (j->>'bg_source_id')::uuid END;

  IF TG_OP = 'INSERT' THEN
    IF unpriv THEN NEW.bg_client_id := NULL; NEW.engagement_id := NULL; END IF;
    IF NEW.bg_client_id IS NULL AND src IS NOT NULL THEN
      SELECT * INTO r FROM public.bg_source_link(TG_TABLE_NAME, src, owner);
      NEW.bg_client_id := r.bg_client_id; NEW.engagement_id := r.engagement_id;
    END IF;
    IF NEW.bg_client_id IS NULL AND j ? 'hub_client' THEN
      SELECT * INTO r FROM public.bg_resolve_hub(j->>'hub_client', j->>'hub_job');
      NEW.bg_client_id := r.bg_client_id; NEW.engagement_id := r.engagement_id;
    END IF;
    NEW.link_status := CASE WHEN NEW.bg_client_id IS NOT NULL AND NEW.engagement_id IS NOT NULL THEN 'linked' ELSE 'unlinked' END;
    RETURN NEW;
  END IF;

  IF unpriv THEN
    NEW.bg_client_id := OLD.bg_client_id; NEW.engagement_id := OLD.engagement_id; NEW.link_status := OLD.link_status;
  END IF;
  IF j ? 'hub_client' THEN
    hub_changed := (j->>'hub_client') IS DISTINCT FROM (to_jsonb(OLD)->>'hub_client')
                OR (j->>'hub_job') IS DISTINCT FROM (to_jsonb(OLD)->>'hub_job');
  END IF;
  IF hub_changed AND NEW.bg_client_id IS NULL AND OLD.link_status = 'unlinked' THEN
    SELECT * INTO r FROM public.bg_resolve_hub(j->>'hub_client', j->>'hub_job');
    NEW.bg_client_id := r.bg_client_id; NEW.engagement_id := r.engagement_id;
  END IF;
  IF NEW.bg_client_id IS DISTINCT FROM OLD.bg_client_id OR NEW.engagement_id IS DISTINCT FROM OLD.engagement_id THEN
    IF NEW.engagement_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.bg_engagements e WHERE e.id = NEW.engagement_id AND e.bg_client_id = NEW.bg_client_id) THEN
      RAISE EXCEPTION 'Engagement belongs to a different client';
    END IF;
    NEW.link_status := CASE WHEN NEW.bg_client_id IS NOT NULL AND NEW.engagement_id IS NOT NULL THEN 'linked'
                            WHEN OLD.link_status = 'legacy' THEN 'legacy' ELSE 'unlinked' END;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER zz_bg_run_link BEFORE INSERT OR UPDATE ON public.synthesiser_runs FOR EACH ROW EXECUTE FUNCTION public.bg_run_link();
CREATE TRIGGER zz_bg_run_link BEFORE INSERT OR UPDATE ON public.intelligence_sessions FOR EACH ROW EXECUTE FUNCTION public.bg_run_link();
CREATE TRIGGER zz_bg_run_link BEFORE INSERT OR UPDATE ON public.briefing_room_workspaces FOR EACH ROW EXECUTE FUNCTION public.bg_run_link();
CREATE TRIGGER zz_bg_run_link BEFORE INSERT OR UPDATE ON public.saved_briefs FOR EACH ROW EXECUTE FUNCTION public.bg_run_link();
CREATE TRIGGER zz_bg_run_link BEFORE INSERT OR UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.bg_run_link();
CREATE TRIGGER zz_bg_run_link BEFORE INSERT OR UPDATE ON public.stimulus_runs FOR EACH ROW EXECUTE FUNCTION public.bg_run_link();

CREATE OR REPLACE FUNCTION public.bg_admin_link_run(_table text, _run_id uuid, _client uuid, _engagement uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prev text; next_status text; idcol text;
BEGIN
  IF NOT public.bg_is_admin(auth.uid()) THEN RAISE EXCEPTION 'Only admins can link runs'; END IF;
  IF _table NOT IN ('synthesiser_runs','intelligence_sessions','briefing_room_workspaces','saved_briefs','sessions','stimulus_runs') THEN
    RAISE EXCEPTION 'Unknown Room table';
  END IF;
  IF _client IS NULL OR _engagement IS NULL THEN RAISE EXCEPTION 'Choose a client and an engagement'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bg_engagements e WHERE e.id = _engagement AND e.bg_client_id = _client) THEN
    RAISE EXCEPTION 'Engagement belongs to a different client';
  END IF;
  idcol := CASE WHEN _table = 'saved_briefs' THEN 'brief_id' ELSE 'id' END;
  EXECUTE format('SELECT link_status FROM public.%I WHERE %I = $1', _table, idcol) INTO prev USING _run_id;
  IF prev IS NULL THEN RAISE EXCEPTION 'Run not found'; END IF;
  EXECUTE format('UPDATE public.%I SET bg_client_id = $1, engagement_id = $2 WHERE %I = $3 RETURNING link_status', _table, idcol)
    INTO next_status USING _client, _engagement, _run_id;
  INSERT INTO public.bg_link_events(run_table, run_id, bg_client_id, engagement_id, from_status, to_status, source, linked_by)
  VALUES (_table, _run_id, _client, _engagement, prev, next_status, 'admin', auth.uid());
  RETURN next_status;
END $$;
REVOKE EXECUTE ON FUNCTION public.bg_admin_link_run(text, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bg_admin_link_run(text, uuid, uuid, uuid) TO authenticated;

ALTER TABLE public.sessions
  ADD COLUMN checkpoint_a_confirmed_by uuid, ADD COLUMN checkpoint_b_confirmed_by uuid, ADD COLUMN checkpoint_c_confirmed_by uuid,
  ADD COLUMN checkpoint_d_confirmed_by uuid, ADD COLUMN checkpoint_e_confirmed_by uuid, ADD COLUMN checkpoint_f_confirmed_by uuid;
ALTER TABLE public.stimulus_runs ADD COLUMN gate_one_confirmed_by uuid;
ALTER TABLE public.stimulus_directions ADD COLUMN gate_one_approved_by uuid;
ALTER TABLE public.stimulus_orchestrations ADD COLUMN gate_two_confirmed_by uuid;
ALTER TABLE public.stimulus_prompts ADD COLUMN gate_two_approved_by uuid;

CREATE OR REPLACE FUNCTION public.bg_record_approver() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE pair text; at_col text; by_col text; n jsonb := to_jsonb(NEW); o jsonb := to_jsonb(OLD); patch jsonb := '{}'::jsonb;
BEGIN
  FOREACH pair IN ARRAY TG_ARGV LOOP
    at_col := pair || '_at'; by_col := pair || '_by';
    IF (n->>at_col) IS NULL THEN
      IF (n->>by_col) IS NOT NULL THEN patch := patch || jsonb_build_object(by_col, NULL); END IF;
    ELSIF (n->>at_col) IS DISTINCT FROM (o->>at_col) THEN
      IF current_user IN ('authenticated','anon') OR (n->>by_col) IS NOT DISTINCT FROM (o->>by_col) THEN
        patch := patch || jsonb_build_object(by_col, auth.uid());
      END IF;
    ELSIF current_user IN ('authenticated','anon') THEN
      patch := patch || jsonb_build_object(by_col, o->by_col);
    END IF;
  END LOOP;
  IF patch <> '{}'::jsonb THEN NEW := jsonb_populate_record(NEW, patch); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER bg_record_approver BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.bg_record_approver(
  'checkpoint_a_confirmed','checkpoint_b_confirmed','checkpoint_c_confirmed','checkpoint_d_confirmed','checkpoint_e_confirmed','checkpoint_f_confirmed');
CREATE TRIGGER bg_record_approver BEFORE UPDATE ON public.stimulus_runs FOR EACH ROW EXECUTE FUNCTION public.bg_record_approver('gate_one_confirmed');
CREATE TRIGGER bg_record_approver BEFORE UPDATE ON public.stimulus_directions FOR EACH ROW EXECUTE FUNCTION public.bg_record_approver('gate_one_approved');
CREATE TRIGGER bg_record_approver BEFORE UPDATE ON public.stimulus_orchestrations FOR EACH ROW EXECUTE FUNCTION public.bg_record_approver('gate_two_confirmed');
CREATE TRIGGER bg_record_approver BEFORE UPDATE ON public.stimulus_prompts FOR EACH ROW EXECUTE FUNCTION public.bg_record_approver('gate_two_approved');

ALTER TABLE public.briefing_room_workspaces ADD CONSTRAINT briefing_room_workspaces_status_check CHECK (status IN ('draft'));
ALTER TABLE public.stimulus_runs ADD CONSTRAINT stimulus_runs_status_check CHECK (status IN ('pending','generating','rated','tissue_check','gate_one','idea_locked','complete','failed'));
ALTER TABLE public.stimulus_directions ADD CONSTRAINT stimulus_directions_status_check CHECK (status IN ('pending','generated','failed','keep','kill','keep_in_play','revise'));
ALTER TABLE public.stimulus_orchestrations ADD CONSTRAINT stimulus_orchestrations_status_check CHECK (status IN ('pending','initial_prompts','extract','propagate','wad','cd','complete','failed'));
ALTER TABLE public.stimulus_prompts ADD CONSTRAINT stimulus_prompts_status_check CHECK (status IN ('active','rejected'));
ALTER TABLE public.stimulus_signatures ADD CONSTRAINT stimulus_signatures_status_check CHECK (status IN ('active','retired'));
ALTER TABLE public.stimulus_cross_refs ADD CONSTRAINT stimulus_cross_refs_status_check CHECK (status IN ('suggested','accepted','rejected','voided'));

COMMENT ON COLUMN public.intelligence_sessions.layer_1_output IS 'DEPRECATED: unused; never read by the app. Kept, not dropped.';
COMMENT ON COLUMN public.intelligence_sessions.layer_2_output IS 'DEPRECATED: unused; never read by the app. Kept, not dropped.';
COMMENT ON COLUMN public.intelligence_sessions.layer_3_output IS 'DEPRECATED: unused; never read by the app. Kept, not dropped.';
COMMENT ON COLUMN public.intelligence_sessions.layer_4_output IS 'DEPRECATED: unused; never read by the app. Kept, not dropped.';
COMMENT ON COLUMN public.intelligence_sessions.layer_5_output IS 'DEPRECATED: unused; never read by the app. Kept, not dropped.';
COMMENT ON COLUMN public.intelligence_sessions.layer_6_output IS 'DEPRECATED: unused; never read by the app. Kept, not dropped.';
COMMENT ON COLUMN public.intelligence_sessions.layer_7_output IS 'DEPRECATED: unused; never read by the app. Kept, not dropped.';
COMMENT ON COLUMN public.intelligence_sessions.layer_8_output IS 'DEPRECATED: unused; never read by the app. Kept, not dropped.';
COMMENT ON COLUMN public.intelligence_sessions.layer_9_output IS 'DEPRECATED: unused; never read by the app. Kept, not dropped.';
COMMENT ON COLUMN public.intelligence_sessions.layer_10_output IS 'DEPRECATED: unused; never read by the app. Kept, not dropped.';
