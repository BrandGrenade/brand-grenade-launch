CREATE OR REPLACE FUNCTION public.hub_disarm_if_drained(_force boolean DEFAULT false) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(7700000000000002);
  IF (_force OR NOT EXISTS (SELECT 1 FROM public.hub_outbox WHERE status = 'pending'))
     AND EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'hub-outbox-retry') THEN
    PERFORM cron.unschedule('hub-outbox-retry');
  END IF;
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'hub_disarm: %', SQLERRM;
END $$;
DROP FUNCTION IF EXISTS public.hub_disarm_if_drained();
REVOKE EXECUTE ON FUNCTION public.hub_disarm_if_drained(boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hub_disarm_if_drained(boolean) TO service_role;