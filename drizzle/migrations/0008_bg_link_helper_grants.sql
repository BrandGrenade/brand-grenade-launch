GRANT EXECUTE ON FUNCTION public.bg_resolve_hub(text, text) TO authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.bg_source_link(text, uuid, uuid) TO authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.bg_is_admin(uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.bg_admin_link_run(text, uuid, uuid, uuid) TO postgres;