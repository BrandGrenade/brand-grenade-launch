ALTER TABLE public.job_supervision
  ADD COLUMN IF NOT EXISTS total_attempts integer NOT NULL DEFAULT 0;