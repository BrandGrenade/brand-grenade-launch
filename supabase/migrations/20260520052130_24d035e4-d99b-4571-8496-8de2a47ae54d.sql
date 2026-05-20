
-- Add session management columns
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS stage_status text,
  ADD COLUMN IF NOT EXISTS interrupted_stage integer,
  ADD COLUMN IF NOT EXISTS checkpoint_a_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checkpoint_a_notes text,
  ADD COLUMN IF NOT EXISTS checkpoint_a_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS checkpoint_b_notes text,
  ADD COLUMN IF NOT EXISTS checkpoint_b_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS checkpoint_c_notes text,
  ADD COLUMN IF NOT EXISTS checkpoint_c_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS selected_format text,
  ADD COLUMN IF NOT EXISTS selection_rationale_1 text,
  ADD COLUMN IF NOT EXISTS selection_rationale_2 text,
  ADD COLUMN IF NOT EXISTS selection_rationale_3 text,
  ADD COLUMN IF NOT EXISTS selection_rationale_4 text,
  ADD COLUMN IF NOT EXISTS selection_rationale_5 text,
  ADD COLUMN IF NOT EXISTS selection_rationale_6 text,
  ADD COLUMN IF NOT EXISTS stage_12_smps jsonb,
  ADD COLUMN IF NOT EXISTS stage_13_verdict text,
  ADD COLUMN IF NOT EXISTS stage_15_clearance_status text,
  ADD COLUMN IF NOT EXISTS brand_positioning text,
  ADD COLUMN IF NOT EXISTS brand_product_truth text,
  ADD COLUMN IF NOT EXISTS brand_audience_relationship text,
  ADD COLUMN IF NOT EXISTS brand_tone_of_voice text,
  ADD COLUMN IF NOT EXISTS brand_constraints text,
  ADD COLUMN IF NOT EXISTS brand_organisational_context text;

-- Status check constraint (drop and add to widen)
ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_status_check;
ALTER TABLE public.sessions ADD CONSTRAINT sessions_status_check
  CHECK (status IN ('pending','running','awaiting_checkpoint','complete','held','error','interrupted'));

ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_selected_format_check;
ALTER TABLE public.sessions ADD CONSTRAINT sessions_selected_format_check
  CHECK (selected_format IS NULL OR selected_format IN ('agency','consulting','workshop'));

-- updated_at trigger
DROP TRIGGER IF EXISTS sessions_set_updated_at ON public.sessions;
CREATE TRIGGER sessions_set_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for dashboard listing
CREATE INDEX IF NOT EXISTS sessions_updated_at_desc_idx ON public.sessions (updated_at DESC);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON public.sessions (user_id);

-- Realtime
ALTER TABLE public.sessions REPLICA IDENTITY FULL;
DO $$ BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- users table
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  plan text NOT NULL DEFAULT 'demo' CHECK (plan IN ('demo','professional','enterprise')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read users" ON public.users;
CREATE POLICY "Anyone can read users" ON public.users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert users" ON public.users;
CREATE POLICY "Anyone can insert users" ON public.users FOR INSERT WITH CHECK (true);
