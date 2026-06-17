REVOKE UPDATE ON public.users FROM authenticated;
GRANT UPDATE (email) ON public.users TO authenticated;
CREATE OR REPLACE FUNCTION public.users_block_plan_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.plan IS DISTINCT FROM OLD.plan AND current_setting('role') <> 'service_role' THEN
    RAISE EXCEPTION 'Updating plan is not permitted';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.users_block_plan_change() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS users_block_plan_change_trg ON public.users;
CREATE TRIGGER users_block_plan_change_trg
BEFORE UPDATE OF plan ON public.users
FOR EACH ROW EXECUTE FUNCTION public.users_block_plan_change();