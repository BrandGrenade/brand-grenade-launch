-- T1 tests: Deal brief type. Self-rolling-back (ends with RAISE).
CREATE TEMP TABLE r(name text, ok boolean);

INSERT INTO r SELECT 'existing runs are Campaign with no deal fields',
  bool_and(brief_type = 'campaign' AND deal_transaction_type IS NULL AND deal_decision_questions IS NULL) FROM public.sessions WHERE created_at < '2026-10-15';

DO $$ BEGIN
  BEGIN
    INSERT INTO public.sessions (brand_name, category, brief_text, status, current_stage, brief_type) VALUES ('x','x','x','running',1,'merger');
    INSERT INTO r VALUES ('unknown brief type rejected', false);
  EXCEPTION WHEN check_violation THEN INSERT INTO r VALUES ('unknown brief type rejected', true); END;
  BEGIN
    INSERT INTO public.sessions (brand_name, category, brief_text, status, current_stage, brief_type, deal_transaction_type)
      VALUES ('x','x','x','running',1,'deal','exit');
    INSERT INTO r VALUES ('deal with missing fields rejected', false);
  EXCEPTION WHEN check_violation THEN INSERT INTO r VALUES ('deal with missing fields rejected', true); END;
  BEGIN
    INSERT INTO public.sessions (brand_name, category, brief_text, status, current_stage, deal_depth) VALUES ('x','x','x','running',1,'data-room');
    INSERT INTO r VALUES ('campaign with deal fields rejected', false);
  EXCEPTION WHEN check_violation THEN INSERT INTO r VALUES ('campaign with deal fields rejected', true); END;
END $$;

INSERT INTO public.sessions (id, brand_name, category, brief_text, status, current_stage, run_mode, diagnostic_status, brief_type,
  deal_transaction_type, deal_target_brands, deal_decision_questions, deal_competitors, deal_decision_date, deal_depth,
  current_proposition, current_proposition_source, current_proposition_date)
VALUES ('00000000-0000-0000-0000-0000000071d1','DealCo','Auto','brief','running',1,'diagnostic','in_progress','deal',
  'buy-side', ARRAY['DealCo'], ARRAY['Can it stretch?'], ARRAY['Rival'], '2026-12-01', 'outside-in', 'Built to last', 'Brief', '2026-10-01');
INSERT INTO r SELECT 'complete deal diagnostic accepted', EXISTS (SELECT 1 FROM public.sessions WHERE id = '00000000-0000-0000-0000-0000000071d1' AND brief_type = 'deal' AND run_mode = 'diagnostic');

UPDATE public.sessions SET stage_1_output = 'S1', version_reason = 'test' WHERE id = '00000000-0000-0000-0000-0000000071d1';
DO $$ BEGIN
  BEGIN
    UPDATE public.sessions SET deal_decision_questions = ARRAY['Other?'] WHERE id = '00000000-0000-0000-0000-0000000071d1';
    INSERT INTO r VALUES ('deal fields immutable after Stage 1', false);
  EXCEPTION WHEN raise_exception THEN INSERT INTO r VALUES ('deal fields immutable after Stage 1', true); END;
  BEGIN
    UPDATE public.sessions SET stage_1_output = NULL, brief_text = 'amended', version_reason = 'resubmit' WHERE id = '00000000-0000-0000-0000-0000000071d1';
    INSERT INTO r SELECT 'resubmit keeps deal fields', (SELECT brief_type = 'deal' AND deal_decision_questions = ARRAY['Can it stretch?'] FROM public.sessions WHERE id = '00000000-0000-0000-0000-0000000071d1');
  EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('resubmit keeps deal fields: ' || SQLERRM, false); END;
END $$;

DO $$ BEGIN
  RAISE EXCEPTION 'T1_TEST_RESULTS passed=% failed=% :: %',
    (SELECT count(*) FILTER (WHERE ok) FROM r), (SELECT count(*) FILTER (WHERE ok IS NOT TRUE) FROM r),
    (SELECT string_agg(CASE WHEN ok THEN 'PASS ' ELSE 'FAIL ' END || name, ' | ') FROM r);
END $$;
