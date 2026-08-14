ALTER TABLE public.stimulus_runs
  ADD COLUMN IF NOT EXISTS creative_guidance text,
  ADD COLUMN IF NOT EXISTS creative_guidance_target integer;

ALTER TABLE public.stimulus_directions
  ADD COLUMN IF NOT EXISTS guidance_alignment text,
  ADD COLUMN IF NOT EXISTS guidance_alignment_note text;