CREATE OR REPLACE VIEW public.brand_register_sessions WITH (security_invoker = true) AS
SELECT id, brand_name, category, status, current_stage, created_at, updated_at, phase_2_status, stage_status, interrupted_stage, last_heartbeat_at, is_preflight_test,
  stage_16_consulting_output IS NOT NULL AS has_stage_16_consulting,
  stage_17_output IS NOT NULL AS has_stage_17,
  stage_22_output IS NOT NULL AS has_stage_22,
  bg_client_id, engagement_id, brief_type, run_mode, archived_at,
  (coalesce(stage_16_consulting_output, stage_16_agency_output, stage_16_workshop_output, stage_16_vision_output, stage_16_valuation_output) IS NOT NULL) AS has_stage_16,
  stage_17b_output IS NOT NULL AS has_stage_17b,
  stage_18_output IS NOT NULL AS has_stage_18,
  stage_19_output IS NOT NULL AS has_stage_19,
  stage_20_output IS NOT NULL AS has_stage_20,
  coalesce(stage_20_approved, false) AS stage_20_approved,
  stage_20b_output IS NOT NULL AS has_stage_20b,
  (stage_21_outputs IS NOT NULL AND stage_21_outputs NOT IN ('{}'::jsonb, '[]'::jsonb, 'null'::jsonb)) AS has_stage_21,
  stage_15_output IS NOT NULL AS has_stage_15
FROM public.sessions s;