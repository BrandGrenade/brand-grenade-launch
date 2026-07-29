ALTER TABLE public.repository_documents DROP CONSTRAINT IF EXISTS repository_documents_repository_slug_check;
ALTER TABLE public.repository_visitors DROP CONSTRAINT IF EXISTS repository_visitors_repository_slug_check;

ALTER TABLE public.repository_documents
  ADD CONSTRAINT repository_documents_repository_slug_fkey
  FOREIGN KEY (repository_slug) REFERENCES public.repositories(slug) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE public.repository_visitors
  ADD CONSTRAINT repository_visitors_repository_slug_fkey
  FOREIGN KEY (repository_slug) REFERENCES public.repositories(slug) ON UPDATE CASCADE ON DELETE CASCADE;