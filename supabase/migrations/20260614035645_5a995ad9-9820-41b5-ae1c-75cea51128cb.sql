-- Add explicit checkpoint columns for D, E, F mirroring A/B/C structure.
-- Existing gate logic in src/lib/checkpoint-gate.ts already enforces D/E/F
-- via stage_17_selected_territory, stage_18_selected_detonation, and
-- stage_20_approved. These new columns store the human's explicit confirmation
-- timestamp and any notes captured at the checkpoint UI, mirroring A/B/C.

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS checkpoint_d_confirmed    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checkpoint_d_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS checkpoint_d_notes        text,
  ADD COLUMN IF NOT EXISTS checkpoint_e_confirmed    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checkpoint_e_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS checkpoint_e_notes        text,
  ADD COLUMN IF NOT EXISTS checkpoint_f_confirmed    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checkpoint_f_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS checkpoint_f_notes        text;