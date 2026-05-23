
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS doc_consulting_sections jsonb,
  ADD COLUMN IF NOT EXISTS doc_agency_sections jsonb,
  ADD COLUMN IF NOT EXISTS doc_workshop_sections jsonb,
  ADD COLUMN IF NOT EXISTS doc_consulting_status_at timestamptz,
  ADD COLUMN IF NOT EXISTS doc_agency_status_at timestamptz,
  ADD COLUMN IF NOT EXISTS doc_workshop_status_at timestamptz;
