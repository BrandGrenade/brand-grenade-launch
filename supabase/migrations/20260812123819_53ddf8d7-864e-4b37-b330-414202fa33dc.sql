DROP POLICY IF EXISTS "Authenticated users can view harness runs" ON public.tier2_harness_runs;
CREATE POLICY "Session members can view harness runs"
ON public.tier2_harness_runs FOR SELECT TO authenticated
USING (public.can_access_session(session_id, auth.uid()));