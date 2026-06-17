ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS brief_versions JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.saved_briefs ADD COLUMN IF NOT EXISTS brief_fields JSONB;
CREATE INDEX IF NOT EXISTS sessions_brief_versions_gin_idx ON public.sessions USING GIN (brief_versions);