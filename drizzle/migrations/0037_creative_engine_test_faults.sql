ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS test_copy_of uuid;
ALTER TABLE public.stimulus_orchestrations ADD COLUMN IF NOT EXISTS test_faults jsonb;

CREATE OR REPLACE FUNCTION public.bg_test_faults_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.test_faults IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.sessions s WHERE s.id = NEW.session_id AND s.test_copy_of IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Test faults are only allowed on a test copy run';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER bg_test_faults_guard BEFORE INSERT OR UPDATE OF test_faults ON public.stimulus_orchestrations
FOR EACH ROW EXECUTE FUNCTION public.bg_test_faults_guard();