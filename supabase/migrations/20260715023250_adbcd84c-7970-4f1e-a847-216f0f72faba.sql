ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS selected_loc_expression text,
  ADD COLUMN IF NOT EXISTS selection_source text,
  ADD COLUMN IF NOT EXISTS selection_engine text;