CREATE TABLE public.session_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  email text NOT NULL,
  invited_by uuid NOT NULL,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  UNIQUE (session_id, email)
);

CREATE INDEX idx_session_collaborators_email ON public.session_collaborators (lower(email));
CREATE INDEX idx_session_collaborators_session ON public.session_collaborators (session_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_collaborators TO authenticated;
GRANT ALL ON public.session_collaborators TO service_role;

ALTER TABLE public.session_collaborators ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_session(_session_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = _session_id AND s.user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.session_collaborators c
    WHERE c.session_id = _session_id
      AND (
        c.user_id = _user_id
        OR lower(c.email) = lower((SELECT u.email FROM auth.users u WHERE u.id = _user_id))
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.is_session_owner(_session_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = _session_id AND s.user_id = _user_id
  )
$$;

CREATE POLICY "Owners manage collaborators" ON public.session_collaborators
  FOR ALL TO authenticated
  USING (public.is_session_owner(session_id, auth.uid()))
  WITH CHECK (public.is_session_owner(session_id, auth.uid()));

CREATE POLICY "Collaborators see own invites" ON public.session_collaborators
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR lower(email) = lower((SELECT u.email FROM auth.users u WHERE u.id = auth.uid()))
  );

CREATE POLICY "Collaborators claim own invites" ON public.session_collaborators
  FOR UPDATE TO authenticated
  USING (lower(email) = lower((SELECT u.email FROM auth.users u WHERE u.id = auth.uid())))
  WITH CHECK (lower(email) = lower((SELECT u.email FROM auth.users u WHERE u.id = auth.uid())));

DROP POLICY IF EXISTS "Users view own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users update own sessions" ON public.sessions;

CREATE POLICY "Users view accessible sessions" ON public.sessions
  FOR SELECT TO authenticated
  USING (public.can_access_session(id, auth.uid()));

CREATE POLICY "Users update accessible sessions" ON public.sessions
  FOR UPDATE TO authenticated
  USING (public.can_access_session(id, auth.uid()))
  WITH CHECK (public.can_access_session(id, auth.uid()));