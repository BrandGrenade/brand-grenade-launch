
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS truth_product text,
  ADD COLUMN IF NOT EXISTS truth_consumer text,
  ADD COLUMN IF NOT EXISTS truth_cultural text,
  ADD COLUMN IF NOT EXISTS truth_cultural_confidence text,
  ADD COLUMN IF NOT EXISTS truth_cultural_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS brand_intel_type text,
  ADD COLUMN IF NOT EXISTS brand_intel_values text,
  ADD COLUMN IF NOT EXISTS brand_intel_tone text,
  ADD COLUMN IF NOT EXISTS brand_intel_assets jsonb,
  ADD COLUMN IF NOT EXISTS brand_intel_confirmed boolean NOT NULL DEFAULT false;
