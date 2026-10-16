-- F1d tests: structured outputs versioned/locked, run type, diagnostic stop/lock/partial. Self-rolling-back.
CREATE TEMP TABLE r(name text, ok boolean);

INSERT INTO r SELECT 'old runs stay text only (no back-fill)', NOT EXISTS (SELECT 1 FROM public.sessions WHERE (stage_9_structured IS NOT NULL OR stage_10_structured IS NOT NULL OR stage_11_structured IS NOT NULL OR stage_13_structured IS NOT NULL) AND created_at < '2026-10-16');
INSERT INTO r SELECT 'existing runs default to full', bool_and(run_mode = 'full' AND diagnostic_status IS NULL) FROM public.sessions WHERE created_at < '2026-10-16';

DO $$ BEGIN
  BEGIN
    INSERT INTO public.sessions (brand_name, category, brief_text, status, current_stage, run_mode) VALUES ('x','x','x','running',1,'quick');
    INSERT INTO r VALUES ('unknown run type rejected', false);
  EXCEPTION WHEN check_violation THEN INSERT INTO r VALUES ('unknown run type rejected', true);
  END;
END $$;

-- Full run: structured output versioned with actor on retry.
INSERT INTO public.sessions (id, brand_name, category, brief_text, status, current_stage, user_id, stage_status, stage_1_output, stage_10_output, stage_10_structured)
SELECT '00000000-0000-0000-0000-00000000f1d1', 'F1d full', 'test', 'brief', 'running', 10, user_id, 'complete:10', 'S1', 'S10 text', '{"scores":[]}'::jsonb
FROM public.sessions WHERE user_id IS NOT NULL LIMIT 1;
UPDATE public.sessions SET stage_10_output = NULL, stage_10_structured = NULL, stage_status = 'running:10',
  version_reason = 'retry: stage 10', version_actor = user_id WHERE id = '00000000-0000-0000-0000-00000000f1d1';
INSERT INTO r SELECT 'structured output versioned with stage, actor recorded', count(*) = 1 AND bool_and(created_by IS NOT NULL AND reason = 'retry: stage 10')
  FROM public.run_output_versions WHERE run_id = '00000000-0000-0000-0000-00000000f1d1' AND field = 'stage_10_structured';
DO $$ BEGIN
  BEGIN
    UPDATE public.sessions SET run_mode = 'diagnostic', diagnostic_status = 'in_progress' WHERE id = '00000000-0000-0000-0000-00000000f1d1';
    INSERT INTO r VALUES ('run type immutable after Stage 1', false);
  EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('run type immutable after Stage 1', SQLERRM LIKE '%Run type%');
  END;
END $$;

-- Diagnostic run with every required output + scored current position -> complete + locked.
INSERT INTO public.sessions (id, brand_name, category, brief_text, status, current_stage, user_id, run_mode, diagnostic_status, stage_status,
  stage_1_output, stage_2_output, stage_9_output, stage_10_output, stage_11_output, stage_10_structured)
SELECT '00000000-0000-0000-0000-00000000f1d2', 'F1d diag', 'test', 'brief', 'running', 13, user_id, 'diagnostic', 'in_progress', 'running:13',
  'S1', 'S2', 'S9', 'S10', 'S11', '{"current_position":{"status":"scored"}}'::jsonb
FROM public.sessions WHERE user_id IS NOT NULL LIMIT 1;
UPDATE public.sessions SET stage_status = 'running:13', current_stage = 13 WHERE id = '00000000-0000-0000-0000-00000000f1d2';
INSERT INTO r SELECT 'diagnostic in progress before Stage 13', diagnostic_status = 'in_progress' AND locked_at IS NULL FROM public.sessions WHERE id = '00000000-0000-0000-0000-00000000f1d2';
UPDATE public.sessions SET stage_13_output = 'S13', stage_status = 'complete:13', stage_13_structured = '{}'::jsonb WHERE id = '00000000-0000-0000-0000-00000000f1d2';
INSERT INTO r SELECT 'diagnostic complete stops and locks', diagnostic_status = 'complete' AND locked_at IS NOT NULL AND lock_reason = 'Diagnostic run completed' FROM public.sessions WHERE id = '00000000-0000-0000-0000-00000000f1d2';
DO $$ BEGIN
  BEGIN
    UPDATE public.sessions SET stage_13b_output = 'x' WHERE id = '00000000-0000-0000-0000-00000000f1d2';
    INSERT INTO r VALUES ('locked diagnostic refuses later stages', false);
  EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('locked diagnostic refuses later stages', SQLERRM LIKE '%locked%');
  END;
  BEGIN
    UPDATE public.sessions SET stage_10_structured = NULL WHERE id = '00000000-0000-0000-0000-00000000f1d2';
    INSERT INTO r VALUES ('locked structured output refused', false);
  EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('locked structured output refused', SQLERRM LIKE '%locked%');
  END;
END $$;

-- Diagnostic missing current position -> partial, never complete.
INSERT INTO public.sessions (id, brand_name, category, brief_text, status, current_stage, user_id, run_mode, diagnostic_status, stage_status,
  stage_1_output, stage_2_output, stage_9_output, stage_10_output, stage_11_output, stage_10_structured)
SELECT '00000000-0000-0000-0000-00000000f1d3', 'F1d diag partial', 'test', 'brief', 'running', 13, user_id, 'diagnostic', 'in_progress', 'running:13',
  'S1', 'S2', 'S9', 'S10', 'S11', '{"current_position":{"status":"not_scored"}}'::jsonb
FROM public.sessions WHERE user_id IS NOT NULL LIMIT 1;
UPDATE public.sessions SET stage_13_output = 'S13', stage_status = 'complete:13' WHERE id = '00000000-0000-0000-0000-00000000f1d3';
INSERT INTO r SELECT 'missing required output -> partial, locked', diagnostic_status = 'partial' AND locked_at IS NOT NULL FROM public.sessions WHERE id = '00000000-0000-0000-0000-00000000f1d3';

-- New full run can point back to a diagnostic.
INSERT INTO public.sessions (id, brand_name, category, brief_text, status, current_stage, continues_diagnostic_id)
VALUES ('00000000-0000-0000-0000-00000000f1d4', 'F1d cont', 'test', 'brief', 'running', 1, '00000000-0000-0000-0000-00000000f1d2');
INSERT INTO r SELECT 'full run links back; diagnostic untouched', s.continues_diagnostic_id IS NOT NULL AND d.stage_13_output = 'S13'
  FROM public.sessions s, public.sessions d WHERE s.id = '00000000-0000-0000-0000-00000000f1d4' AND d.id = '00000000-0000-0000-0000-00000000f1d2';

DO $$ BEGIN
  RAISE EXCEPTION 'F1D_TEST_RESULTS passed=% failed=% :: %',
    (SELECT count(*) FILTER (WHERE ok) FROM r), (SELECT count(*) FILTER (WHERE ok IS NOT TRUE) FROM r),
    (SELECT string_agg(CASE WHEN ok THEN 'PASS ' ELSE 'FAIL ' END || name, ' | ') FROM r);
END $$;
