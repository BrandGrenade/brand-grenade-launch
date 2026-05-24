-- ============================================================
-- 1. USERS TABLE LOCKDOWN
-- ============================================================
DROP POLICY IF EXISTS "Anyone can read users"   ON public.users;
DROP POLICY IF EXISTS "Anyone can insert users" ON public.users;

CREATE POLICY "Users read own row"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users insert own row (never as admin)"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id AND is_admin = false);

-- ============================================================
-- 2. BACKFILL sessions.user_id when there is exactly one auth user
-- ============================================================
DO $$
DECLARE
  v_count int;
  v_uid uuid;
BEGIN
  SELECT COUNT(*) INTO v_count FROM auth.users;
  IF v_count = 1 THEN
    SELECT id INTO v_uid FROM auth.users LIMIT 1;
    UPDATE public.sessions SET user_id = v_uid WHERE user_id IS NULL;
  END IF;
END $$;

-- ============================================================
-- 3. SESSIONS TABLE LOCKDOWN
-- ============================================================
DROP POLICY IF EXISTS "Anyone can view sessions"   ON public.sessions;
DROP POLICY IF EXISTS "Anyone can create sessions" ON public.sessions;
DROP POLICY IF EXISTS "Anyone can update sessions" ON public.sessions;
DROP POLICY IF EXISTS "Anyone can delete sessions" ON public.sessions;

CREATE POLICY "Users view own sessions"
  ON public.sessions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users create own sessions"
  ON public.sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own sessions"
  ON public.sessions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own sessions"
  ON public.sessions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- 4. DOCUMENTS STORAGE LOCKDOWN
-- The server uses the service-role key (RLS-bypass) and signed URLs
-- to serve client downloads. Direct browser RLS access is not needed.
-- ============================================================
DROP POLICY IF EXISTS "documents bucket read"   ON storage.objects;
DROP POLICY IF EXISTS "documents bucket insert" ON storage.objects;
DROP POLICY IF EXISTS "documents bucket update" ON storage.objects;
DROP POLICY IF EXISTS "documents bucket delete" ON storage.objects;
