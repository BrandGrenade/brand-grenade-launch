REVOKE ALL ON public.bg_access_keys FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.bg_access_log FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.bg_access_log FROM service_role;
GRANT SELECT, INSERT ON public.bg_access_log TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.bg_access_keys TO service_role;
REVOKE DELETE, TRUNCATE ON public.bg_access_keys FROM service_role;