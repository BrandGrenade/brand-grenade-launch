ALTER TABLE public.stimulus_orchestrations
  ADD COLUMN mandate_text text,
  ADD COLUMN mandate_source text,
  ADD COLUMN mandate_signature_id uuid REFERENCES public.stimulus_signatures(id) ON DELETE SET NULL,
  ADD COLUMN mandate_applied_at timestamptz,
  ADD COLUMN mandate_log jsonb NOT NULL DEFAULT '[]'::jsonb;