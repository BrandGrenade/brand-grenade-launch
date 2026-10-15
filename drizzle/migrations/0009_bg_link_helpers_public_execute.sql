-- Trigger helpers must run for every role that writes Room runs (app roles, cron, internal tools).
GRANT EXECUTE ON FUNCTION public.bg_resolve_hub(text, text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.bg_source_link(text, uuid, uuid) TO PUBLIC;