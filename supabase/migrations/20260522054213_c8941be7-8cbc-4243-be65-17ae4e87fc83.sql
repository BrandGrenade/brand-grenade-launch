-- New per-format document fields on sessions
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS doc_consulting_url    text,
  ADD COLUMN IF NOT EXISTS doc_agency_url        text,
  ADD COLUMN IF NOT EXISTS doc_workshop_url      text,
  ADD COLUMN IF NOT EXISTS doc_consulting_status text,
  ADD COLUMN IF NOT EXISTS doc_agency_status     text,
  ADD COLUMN IF NOT EXISTS doc_workshop_status   text;

-- Private 'documents' bucket for generated HTML
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  52428800,
  ARRAY['text/html']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies — service role bypasses RLS, but allow authenticated
-- and anon reads/writes on this bucket so signed-URL flows and any
-- client-side fallback work consistently with the rest of the project.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'documents bucket read'
  ) THEN
    CREATE POLICY "documents bucket read"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'documents bucket insert'
  ) THEN
    CREATE POLICY "documents bucket insert"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'documents bucket update'
  ) THEN
    CREATE POLICY "documents bucket update"
      ON storage.objects FOR UPDATE
      USING (bucket_id = 'documents');
  END IF;
END $$;