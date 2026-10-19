CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.bg_intelligence_wake()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wake boolean := false;
  new_pending jsonb;
  old_pending jsonb;
BEGIN
  IF NEW.status = 'running' AND NEW.stage_status = 'queued'
     AND (TG_OP = 'INSERT' OR OLD.stage_status IS DISTINCT FROM 'queued' OR OLD.status IS DISTINCT FROM 'running') THEN
    wake := true;
  END IF;

  IF NEW.status = 'running' AND NEW.stage_status LIKE 'revising:%' THEN
    new_pending := CASE WHEN jsonb_typeof(NEW.report_metadata) = 'object' THEN NEW.report_metadata->'pending_revision' END;
    old_pending := CASE WHEN TG_OP = 'UPDATE' AND jsonb_typeof(OLD.report_metadata) = 'object' THEN OLD.report_metadata->'pending_revision' END;
    IF new_pending IS NOT NULL AND (new_pending->>'claimed_at') IS NULL
       AND new_pending IS DISTINCT FROM old_pending THEN
      wake := true;
    END IF;
  END IF;

  IF wake THEN
    BEGIN
      PERFORM net.http_post(
        url := 'https://project--00f8f168-9af0-4e35-a994-3f3194d41422.lovable.app/api/public/intelligence-tick',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object('session', NEW.id),
        timeout_milliseconds := 1200000
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'intelligence wake failed for %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.bg_intelligence_wake() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS bg_intelligence_wake ON public.intelligence_sessions;
CREATE TRIGGER bg_intelligence_wake
AFTER INSERT OR UPDATE OF status, stage_status, report_metadata ON public.intelligence_sessions
FOR EACH ROW EXECUTE FUNCTION public.bg_intelligence_wake();