UPDATE public.sessions
SET stage_18_detonation_line = 'Locked in sounds like a promise. It''s a limit.'
WHERE id = '55a48e67-b303-4b98-bb17-c2eaaa414163';

UPDATE public.stimulus_directions d
SET master_line_at_generation = 'Locked in sounds like a promise. It''s a limit.',
    expression_under_master = NULLIF(btrim(regexp_replace(d.expression_under_master, '^\s*Detonation\s*3\s*[:\-—]?\s*', '')), '')
FROM public.stimulus_runs r
WHERE r.id = d.run_id
  AND r.session_id = '55a48e67-b303-4b98-bb17-c2eaaa414163'
  AND d.master_line_at_generation IS NOT NULL;

UPDATE public.stimulus_direction_attempts a
SET master_line_at_generation = 'Locked in sounds like a promise. It''s a limit.',
    expression_under_master = NULLIF(btrim(regexp_replace(a.expression_under_master, '^\s*Detonation\s*3\s*[:\-—]?\s*', '')), '')
FROM public.stimulus_runs r
WHERE r.id = a.run_id
  AND r.session_id = '55a48e67-b303-4b98-bb17-c2eaaa414163'
  AND a.master_line_at_generation IS NOT NULL;