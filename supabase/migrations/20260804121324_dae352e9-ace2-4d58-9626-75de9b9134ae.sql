CREATE OR REPLACE VIEW public.brand_register_sessions
WITH (security_invoker = true) AS
SELECT
  s.id,
  s.brand_name,
  s.category,
  s.status,
  s.current_stage,
  s.created_at,
  s.updated_at,
  s.phase_2_status,
  s.stage_status,
  s.interrupted_stage,
  s.last_heartbeat_at,
  s.is_preflight_test,
  (s.stage_16_consulting_output IS NOT NULL) AS has_stage_16_consulting,
  (s.stage_17_output IS NOT NULL) AS has_stage_17,
  (s.stage_22_output IS NOT NULL) AS has_stage_22
FROM public.sessions s;

GRANT SELECT ON public.brand_register_sessions TO authenticated;
GRANT SELECT ON public.brand_register_sessions TO service_role;

CREATE OR REPLACE VIEW public.brand_register_briefings
WITH (security_invoker = true) AS
SELECT
  w.id,
  w.brand_name,
  w.category,
  w.status,
  w.created_at,
  w.updated_at,
  w.selected_tension_index,
  (w.diagnosis IS NOT NULL) AS has_diagnosis,
  (w.truths IS NOT NULL) AS has_truths,
  (w.relevance IS NOT NULL) AS has_relevance,
  (w.tensions IS NOT NULL) AS has_tensions
FROM public.briefing_room_workspaces w;

GRANT SELECT ON public.brand_register_briefings TO authenticated;
GRANT SELECT ON public.brand_register_briefings TO service_role;