
CREATE TABLE public.repositories (
  slug TEXT PRIMARY KEY CHECK (slug ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$'),
  title TEXT NOT NULL,
  intro TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.repositories TO service_role;

ALTER TABLE public.repositories ENABLE ROW LEVEL SECURITY;

-- No policies: table is accessed only via server-side admin (service_role bypasses RLS).

CREATE TRIGGER update_repositories_updated_at
  BEFORE UPDATE ON public.repositories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.repositories (slug, title, intro) VALUES
  ('ey', 'Brand Grenade — EY',
   'This is your reference resource for Brand Grenade — what it is, what it does, and what it makes possible for EY specifically. Everything here is built around EY''s specific commercial opportunity. Share it with anyone inside EY who needs to understand what Brand Grenade is and why it matters for your practice.'),
  ('kpmg', 'Brand Grenade — KPMG',
   'This is your reference resource for Brand Grenade — what it is, what it does, and what it makes possible for KPMG Customer specifically. Everything here is built around KPMG Customer''s specific commercial opportunity. Share it with anyone inside KPMG who needs to understand what Brand Grenade is and why it matters for your practice.'),
  ('deck', 'Brand Grenade — Platform Overview',
   'This is the complete Brand Grenade platform overview — the world''s first complete brand strategy, creative intelligence, and campaign execution system. Four connected rooms. One AI-governed methodology. One audit trail from research to execution.')
ON CONFLICT (slug) DO NOTHING;
