CREATE OR REPLACE FUNCTION public.bg_guard_confirmed_selection_save() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
 IF coalesce(OLD.checkpoint_c_confirmed,false) AND NEW.selected_smp IS DISTINCT FROM OLD.selected_smp AND coalesce(NEW.checkpoint_c_confirmed,false) THEN
  RAISE EXCEPTION 'This selection is already confirmed. Use Choose again to keep the earlier decision and confirm the new one.' USING ERRCODE='P0001';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.bg_guard_confirmed_selection_save() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bg_guard_confirmed_selection_save() TO service_role;
CREATE TRIGGER a0_guard_confirmed_selection_save BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.bg_guard_confirmed_selection_save();