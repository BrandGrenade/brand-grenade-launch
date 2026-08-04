ALTER TABLE public.stimulus_prompts
  ADD COLUMN signatures_extracted boolean NOT NULL DEFAULT false,
  ADD COLUMN propagated boolean NOT NULL DEFAULT false,
  ADD COLUMN cd_note text;