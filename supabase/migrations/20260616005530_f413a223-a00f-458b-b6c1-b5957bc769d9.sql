-- RLS policies on storage.objects scoped to the `documents` bucket.
-- Storage paths are: `{sessionId}/{format}.html` — first folder = session UUID.
-- Authenticated users may only access objects whose first folder is a session
-- they own (sessions.user_id = auth.uid()). Service role bypasses RLS by default.

DROP POLICY IF EXISTS "Users can read their own session documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can insert their own session documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own session documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own session documents" ON storage.objects;

CREATE POLICY "Users can read their own session documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id::text = (storage.foldername(name))[1]
      AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own session documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id::text = (storage.foldername(name))[1]
      AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own session documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id::text = (storage.foldername(name))[1]
      AND s.user_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id::text = (storage.foldername(name))[1]
      AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own session documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id::text = (storage.foldername(name))[1]
      AND s.user_id = auth.uid()
  )
);
