ALTER TABLE public.stimulus_directions
  ADD COLUMN IF NOT EXISTS expression_under_master text,
  ADD COLUMN IF NOT EXISTS master_line_at_generation text;

ALTER TABLE public.stimulus_direction_attempts
  ADD COLUMN IF NOT EXISTS expression_under_master text,
  ADD COLUMN IF NOT EXISTS master_line_at_generation text;

CREATE OR REPLACE FUNCTION public.clear_orphaned_expressions_under_master()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF coalesce(btrim(NEW.stage_18_detonation_line), '') IS DISTINCT FROM coalesce(btrim(OLD.stage_18_detonation_line), '')
     AND coalesce(btrim(NEW.stage_18_detonation_line), '') = '' THEN
    UPDATE public.stimulus_directions d
       SET expression_under_master = NULL,
           master_line_at_generation = NULL
      FROM public.stimulus_runs r
     WHERE d.run_id = r.id
       AND r.session_id = NEW.id
       AND (d.expression_under_master IS NOT NULL OR d.master_line_at_generation IS NOT NULL);

    UPDATE public.stimulus_direction_attempts a
       SET expression_under_master = NULL,
           master_line_at_generation = NULL
      FROM public.stimulus_runs r
     WHERE a.run_id = r.id
       AND r.session_id = NEW.id
       AND (a.expression_under_master IS NOT NULL OR a.master_line_at_generation IS NOT NULL);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sessions_clear_orphaned_expressions ON public.sessions;
CREATE TRIGGER sessions_clear_orphaned_expressions
AFTER UPDATE OF stage_18_detonation_line ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.clear_orphaned_expressions_under_master();