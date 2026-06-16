CREATE TABLE public.saved_briefs (
  brief_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  brief_text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX saved_briefs_user_created_idx ON public.saved_briefs (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_briefs TO authenticated;
GRANT ALL ON public.saved_briefs TO service_role;

ALTER TABLE public.saved_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own saved briefs"
  ON public.saved_briefs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own saved briefs"
  ON public.saved_briefs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved briefs"
  ON public.saved_briefs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved briefs"
  ON public.saved_briefs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);