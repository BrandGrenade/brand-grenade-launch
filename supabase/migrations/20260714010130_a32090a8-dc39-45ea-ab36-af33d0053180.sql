ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS strategy_signoff_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS strategy_signoff_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS strategy_signoff_stop boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS strategy_signoff_stop_at timestamptz;

COMMENT ON COLUMN public.sessions.strategy_signoff_confirmed IS
  'Checkpoint D (Master Brand Strategy Sign-Off) between Stage 13 and Stage 14. Independent of Stage 17 checkpoint_d_confirmed (Creative Territory).';
COMMENT ON COLUMN public.sessions.strategy_signoff_stop IS
  'True when user chose Option B "Stop here — strategy complete" at Checkpoint D. Session remains resumable to Stage 14.';