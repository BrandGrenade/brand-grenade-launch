-- ISOLATED EMPTY TEST DATABASE ONLY. Reduced run-table fixtures; never use on the live database.
DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF; IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role; END IF; END $$;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE public.users(id uuid PRIMARY KEY,is_admin boolean);
CREATE TABLE public.bg_clients(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL,created_at timestamptz DEFAULT now());
CREATE TABLE public.bg_engagements(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bg_client_id uuid REFERENCES bg_clients,name text);
CREATE TABLE public.bg_external_ids(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bg_client_id uuid REFERENCES bg_clients,engagement_id uuid REFERENCES bg_engagements,system text,external_id text,UNIQUE(system,external_id));
CREATE UNIQUE INDEX one_hub_client ON bg_external_ids(bg_client_id) WHERE system='hub_client';
CREATE TABLE public.bg_link_events(id uuid DEFAULT gen_random_uuid(),run_table text,run_id uuid,bg_client_id uuid,engagement_id uuid,from_status text,to_status text,source text,linked_by uuid);
CREATE FUNCTION public.bg_is_admin(u uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT coalesce((SELECT is_admin FROM users WHERE id=u),false) $$;
GRANT USAGE ON SCHEMA public,auth TO authenticated,anon,service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO PUBLIC;
CREATE TABLE public.synthesiser_runs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),brief_id uuid DEFAULT gen_random_uuid(),user_id uuid,created_by uuid,session_id uuid,bg_source_id uuid,brand_name text,brief_text text,stage_16_vision_output text,bg_client_id uuid,engagement_id uuid,link_status text DEFAULT 'unlinked',hub_client text,hub_job text,hub_ctx text);
 GRANT SELECT,INSERT,UPDATE ON public.synthesiser_runs TO authenticated,service_role;
CREATE TABLE public.intelligence_sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),brief_id uuid DEFAULT gen_random_uuid(),user_id uuid,created_by uuid,session_id uuid,bg_source_id uuid,brand_name text,brief_text text,stage_16_vision_output text,bg_client_id uuid,engagement_id uuid,link_status text DEFAULT 'unlinked',hub_client text,hub_job text,hub_ctx text);
 GRANT SELECT,INSERT,UPDATE ON public.intelligence_sessions TO authenticated,service_role;
CREATE TABLE public.briefing_room_workspaces(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),brief_id uuid DEFAULT gen_random_uuid(),user_id uuid,created_by uuid,session_id uuid,bg_source_id uuid,brand_name text,brief_text text,stage_16_vision_output text,bg_client_id uuid,engagement_id uuid,link_status text DEFAULT 'unlinked',hub_client text,hub_job text,hub_ctx text);
 GRANT SELECT,INSERT,UPDATE ON public.briefing_room_workspaces TO authenticated,service_role;
CREATE TABLE public.sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),brief_id uuid DEFAULT gen_random_uuid(),user_id uuid,created_by uuid,session_id uuid,bg_source_id uuid,brand_name text,brief_text text,stage_16_vision_output text,bg_client_id uuid,engagement_id uuid,link_status text DEFAULT 'unlinked',hub_client text,hub_job text,hub_ctx text);
 GRANT SELECT,INSERT,UPDATE ON public.sessions TO authenticated,service_role;
CREATE TABLE public.saved_briefs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),brief_id uuid DEFAULT gen_random_uuid(),user_id uuid,created_by uuid,session_id uuid,bg_source_id uuid,brand_name text,brief_text text,stage_16_vision_output text,bg_client_id uuid,engagement_id uuid,link_status text DEFAULT 'unlinked',hub_client text,hub_job text,hub_ctx text);
 GRANT SELECT,INSERT,UPDATE ON public.saved_briefs TO authenticated,service_role;
CREATE TABLE public.stimulus_runs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),brief_id uuid DEFAULT gen_random_uuid(),user_id uuid,created_by uuid,session_id uuid,bg_source_id uuid,brand_name text,brief_text text,stage_16_vision_output text,bg_client_id uuid,engagement_id uuid,link_status text DEFAULT 'unlinked',hub_client text,hub_job text,hub_ctx text);
 GRANT SELECT,INSERT,UPDATE ON public.stimulus_runs TO authenticated,service_role;
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

GRANT EXECUTE ON FUNCTION public.bg_source_link(text,uuid,uuid) TO PUBLIC;
GRANT SELECT ON public.bg_engagements TO authenticated;
