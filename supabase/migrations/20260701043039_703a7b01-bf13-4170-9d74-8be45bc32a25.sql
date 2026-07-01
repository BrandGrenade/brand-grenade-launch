
CREATE TABLE public.briefing_room_workspaces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  raw_brief TEXT NOT NULL DEFAULT '',
  supporting_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  diagnosis JSONB,
  truths JSONB,
  relevance JSONB,
  tensions JSONB,
  selected_frame TEXT,
  selected_tension_index INT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.briefing_room_workspaces TO authenticated;
GRANT ALL ON public.briefing_room_workspaces TO service_role;

ALTER TABLE public.briefing_room_workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own briefing workspaces"
  ON public.briefing_room_workspaces FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.briefing_room_touch_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER briefing_room_workspaces_touch
  BEFORE UPDATE ON public.briefing_room_workspaces
  FOR EACH ROW EXECUTE FUNCTION public.briefing_room_touch_updated_at();

CREATE INDEX briefing_room_workspaces_user_idx
  ON public.briefing_room_workspaces (user_id, updated_at DESC);
