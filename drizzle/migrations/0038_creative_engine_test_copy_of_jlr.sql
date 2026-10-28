DO $$
DECLARE src uuid := '3470f1ad-b322-4230-8e3d-bf0072e95b7a'; ns uuid := gen_random_uuid();
 cols text; r record; nr uuid; d record; map jsonb := '{}';
BEGIN
 SELECT string_agg(quote_ident(column_name), ',') INTO cols FROM information_schema.columns
  WHERE table_schema='public' AND table_name='sessions' AND is_generated='NEVER'
  AND column_name NOT IN ('id','created_at','updated_at','hub_client','hub_job','hub_ctx','bg_client_id','engagement_id','link_status','brand_name','test_copy_of','archived_at','archived_by','bg_source_id');
 EXECUTE format('INSERT INTO sessions (id, brand_name, test_copy_of, %s) SELECT %L, %L, %L, %s FROM sessions WHERE id=%L', cols, ns, 'Creative Engine Test (copy of JLR)', src, cols, src);
 SELECT string_agg(quote_ident(column_name), ',') INTO cols FROM information_schema.columns
  WHERE table_schema='public' AND table_name='stimulus_runs' AND is_generated='NEVER'
  AND column_name NOT IN ('id','session_id','created_at','updated_at','hub_client','hub_job','hub_ctx','bg_client_id','engagement_id','link_status','winning_direction_id','winning_line_direction_id','archived_at','archived_by');
 FOR r IN SELECT id FROM stimulus_runs WHERE session_id=src AND gate_one_confirmed AND run_mode='channel_adaptation' LOOP
  nr := gen_random_uuid(); map := map || jsonb_build_object(r.id::text, nr);
  EXECUTE format('INSERT INTO stimulus_runs (id, session_id, %s) SELECT %L, %L, %s FROM stimulus_runs WHERE id=%L', cols, nr, ns, cols, r.id);
 END LOOP;
 SELECT string_agg(quote_ident(column_name), ',') INTO cols FROM information_schema.columns
  WHERE table_schema='public' AND table_name='stimulus_directions' AND is_generated='NEVER'
  AND column_name NOT IN ('id','run_id','created_at','updated_at','active_attempt_id');
 FOR d IN SELECT id, run_id FROM stimulus_directions WHERE gate_one_approved AND run_id IN (SELECT k::uuid FROM jsonb_object_keys(map) k) LOOP
  EXECUTE format('INSERT INTO stimulus_directions (id, run_id, %s) SELECT gen_random_uuid(), %L, %s FROM stimulus_directions WHERE id=%L', cols, map->>(d.run_id::text), cols, d.id);
 END LOOP;
END $$;