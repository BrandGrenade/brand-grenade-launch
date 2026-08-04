REVOKE EXECUTE ON FUNCTION public.can_access_session(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_session_owner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_session(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_session_owner(uuid, uuid) TO authenticated, service_role;