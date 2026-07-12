ALTER TABLE public.intelligence_sessions
  ADD COLUMN input_primary_consumer text,
  ADD COLUMN input_brand_health text,
  ADD COLUMN input_competitive_audit text,
  ADD COLUMN input_cultural_trends text,
  ADD COLUMN input_audience_segmentation text,
  ADD COLUMN input_bg_intel_pack text,
  ADD COLUMN input_files jsonb DEFAULT '[]';