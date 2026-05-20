ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS dev_mode boolean NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
UPDATE public.users SET is_admin = true WHERE is_admin = false;