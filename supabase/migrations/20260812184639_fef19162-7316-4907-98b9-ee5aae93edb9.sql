DO $$
DECLARE
  sid uuid := '6ab4ea96-7c3a-4e0a-91a9-24b601752b35';
  pat text := 'Replace\s+A jaguar never announces itself with\s*-?\s*Stealth\.\s*By Design\.\s*this speaks to the\s*brand icon but also to the new Jaguar\.';
  col text;
BEGIN
  FOR col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='sessions' AND data_type='text'
  LOOP
    EXECUTE format(
      'UPDATE public.sessions SET %1$I = regexp_replace(%1$I, $p$%2$s$p$, ''Stealth. By Design.'', ''gi'') WHERE id = $1 AND %1$I ~* $p2$%2$s$p2$',
      col, pat
    ) USING sid;
  END LOOP;

  UPDATE public.stimulus_runs
     SET smp = regexp_replace(smp, pat, 'Stealth. By Design.', 'gi')
   WHERE session_id = sid AND smp ~* pat;
END $$;