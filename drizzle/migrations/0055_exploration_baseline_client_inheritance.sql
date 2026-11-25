CREATE FUNCTION public.bg_exploration_source_client() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE b public.current_position_addon_jobs; s public.sessions; mapped uuid; BEGIN
 IF NEW.exploration_brief IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO b FROM public.current_position_addon_jobs WHERE id=(NEW.exploration_brief->>'baselineJobId')::uuid;
 SELECT * INTO s FROM public.sessions WHERE id=b.session_id;
 IF s.id IS NULL OR NOT (s.user_id=NEW.user_id OR public.bg_is_admin(NEW.user_id)) THEN RAISE EXCEPTION 'EXPLORATION_BASELINE_ACCESS_DENIED'; END IF;
 IF NEW.hub_client IS NOT NULL THEN SELECT bg_client_id INTO mapped FROM public.bg_external_ids WHERE system='hub_client' AND external_id=NEW.hub_client;
 IF mapped IS DISTINCT FROM s.bg_client_id THEN RAISE EXCEPTION 'EXPLORATION_BASELINE_CLIENT_MISMATCH'; END IF; END IF;
 NEW.bg_client_id:=s.bg_client_id; NEW.engagement_id:=s.engagement_id; NEW.link_status:=CASE WHEN s.bg_client_id IS NULL THEN 'unlinked' ELSE 'linked' END;
 RETURN NEW; END $$;
CREATE TRIGGER aa_exploration_source_client BEFORE INSERT ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.bg_exploration_source_client();