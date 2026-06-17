DROP POLICY IF EXISTS "Users update own row (non-admin fields)" ON public.users;
CREATE POLICY "Users update own row (non-admin fields)"
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND is_admin = false
  AND plan = (SELECT u.plan FROM public.users u WHERE u.id = auth.uid())
  AND email = (SELECT u.email FROM public.users u WHERE u.id = auth.uid())
);