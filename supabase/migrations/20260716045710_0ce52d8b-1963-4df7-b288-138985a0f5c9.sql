
-- Repository visitors (named password entries per repo)
CREATE TABLE public.repository_visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_slug text NOT NULL CHECK (repository_slug IN ('ey','kpmg','deck')),
  name text NOT NULL,
  organisation text,
  email text,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX repository_visitors_slug_idx ON public.repository_visitors(repository_slug);
GRANT ALL ON public.repository_visitors TO service_role;
ALTER TABLE public.repository_visitors ENABLE ROW LEVEL SECURITY;
-- No client access; service_role only via server fns.

-- Repository documents (uploaded by admin)
CREATE TABLE public.repository_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_slug text NOT NULL CHECK (repository_slug IN ('ey','kpmg','deck')),
  title text NOT NULL,
  description text,
  storage_path text NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('pdf','html','other')),
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX repository_documents_slug_idx ON public.repository_documents(repository_slug, display_order);
GRANT ALL ON public.repository_documents TO service_role;
ALTER TABLE public.repository_documents ENABLE ROW LEVEL SECURITY;

-- Access log
CREATE TABLE public.repository_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_slug text NOT NULL,
  visitor_id uuid REFERENCES public.repository_visitors(id) ON DELETE SET NULL,
  visitor_name text,
  event_type text NOT NULL CHECK (event_type IN ('visit','unlock','open','download')),
  document_id uuid REFERENCES public.repository_documents(id) ON DELETE SET NULL,
  document_title text,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX repo_log_slug_time_idx ON public.repository_access_log(repository_slug, created_at DESC);
CREATE INDEX repo_log_visitor_idx ON public.repository_access_log(visitor_id, created_at DESC);
GRANT ALL ON public.repository_access_log TO service_role;
ALTER TABLE public.repository_access_log ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER repository_visitors_touch BEFORE UPDATE ON public.repository_visitors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER repository_documents_touch BEFORE UPDATE ON public.repository_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
