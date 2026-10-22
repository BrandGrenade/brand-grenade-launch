CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.bg_stage20b_wake()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stage_20b_error = '__STAGE_20B_RUNNING__'
     AND NEW.stage_20b_output IS NULL
     AND (TG_OP = 'INSERT' OR OLD.stage_20b_error IS DISTINCT FROM NEW.stage_20b_error) THEN
    BEGIN
      PERFORM net.http_post(
        url := 'https://project--00f8f168-9af0-4e35-a994-3f3194d41422.lovable.app/api/public/stage20b-tick',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object('session', NEW.id),
        timeout_milliseconds := 1200000
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'stage20b wake failed for %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.bg_stage20b_wake() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS bg_stage20b_wake ON public.sessions;
CREATE TRIGGER bg_stage20b_wake
AFTER INSERT OR UPDATE OF stage_20b_error, stage_20b_output ON public.sessions
FOR EACH ROW EXECUTE FUNCTION public.bg_stage20b_wake();