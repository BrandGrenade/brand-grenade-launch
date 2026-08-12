CREATE TABLE public.channel_prompt_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL,
  run_id uuid NOT NULL,
  direction_id uuid NOT NULL,
  version_no integer NOT NULL,
  text text NOT NULL,
  origin text NOT NULL DEFAULT 'generated',
  fidelity jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (direction_id, version_no)
);
CREATE INDEX idx_channel_prompt_versions_direction ON public.channel_prompt_versions (direction_id, version_no DESC);
CREATE INDEX idx_channel_prompt_versions_session ON public.channel_prompt_versions (session_id);
GRANT ALL ON public.channel_prompt_versions TO service_role;
ALTER TABLE public.channel_prompt_versions ENABLE ROW LEVEL SECURITY;