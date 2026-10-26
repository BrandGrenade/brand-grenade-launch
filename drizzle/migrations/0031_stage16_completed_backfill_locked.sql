ALTER TABLE public.sessions DISABLE TRIGGER USER;
UPDATE public.sessions SET stage_16_completed_formats = array_remove(ARRAY[
  CASE WHEN length(coalesce(stage_16_agency_output,'')) > 1000 THEN 'agency' END,
  CASE WHEN length(coalesce(stage_16_consulting_output,'')) > 1000 THEN 'consulting' END,
  CASE WHEN length(coalesce(stage_16_workshop_output,'')) > 1000 THEN 'workshop' END,
  CASE WHEN length(coalesce(stage_16_vision_output,'')) > 1000 THEN 'vision' END,
  CASE WHEN length(coalesce(stage_16_valuation_output,'')) > 1000 THEN 'valuation' END], NULL)
WHERE locked_at IS NOT NULL;
ALTER TABLE public.sessions ENABLE TRIGGER USER;