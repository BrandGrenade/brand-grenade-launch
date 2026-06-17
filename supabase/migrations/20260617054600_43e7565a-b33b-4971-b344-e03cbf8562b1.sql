
-- Fix 1: Prevent users from modifying is_admin via column-level grants + UPDATE policy
REVOKE UPDATE ON public.users FROM authenticated;
REVOKE UPDATE ON public.users FROM anon;
GRANT UPDATE (email, plan) ON public.users TO authenticated;

CREATE POLICY "Users update own row (non-admin fields)"
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id AND is_admin = false);

-- Defense in depth: trigger blocks is_admin changes from non-service roles
CREATE OR REPLACE FUNCTION public.users_block_is_admin_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin
     AND current_setting('request.jwt.claim.role', true) <> 'service_role' THEN
    RAISE EXCEPTION 'is_admin can only be modified by service_role';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_block_is_admin_change
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.users_block_is_admin_change();

-- Fix 2: Scope preflight_checks SELECT to the user who started it
DROP POLICY "Authenticated can read all preflight checks" ON public.preflight_checks;

CREATE POLICY "Authenticated can read own preflight checks"
ON public.preflight_checks
FOR SELECT
TO authenticated
USING (started_by = auth.uid());
