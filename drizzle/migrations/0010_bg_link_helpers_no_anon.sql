REVOKE EXECUTE ON FUNCTION public.bg_resolve_hub(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bg_source_link(text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bg_resolve_hub(text, text) TO authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.bg_source_link(text, uuid, uuid) TO authenticated, service_role, postgres;