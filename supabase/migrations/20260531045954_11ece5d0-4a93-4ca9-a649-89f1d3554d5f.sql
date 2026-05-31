ALTER TABLE public.sessions ALTER COLUMN phase_2_current_stage DROP DEFAULT;
ALTER TABLE public.sessions ALTER COLUMN phase_2_current_stage TYPE text USING phase_2_current_stage::text;
ALTER TABLE public.sessions ALTER COLUMN phase_2_current_stage SET DEFAULT '0';
ALTER TABLE public.sessions ALTER COLUMN phase_2_current_stage SET NOT NULL;