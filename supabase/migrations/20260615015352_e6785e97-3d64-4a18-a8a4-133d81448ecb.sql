DROP POLICY IF EXISTS "Users update own sessions" ON public.sessions;

CREATE POLICY "Users update own sessions"
ON public.sessions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND user_id = (SELECT user_id FROM public.sessions s WHERE s.id = public.sessions.id));