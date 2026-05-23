
-- Fix: scope id-verification uploads to user's own folder
DROP POLICY IF EXISTS "Users can upload ID photos" ON storage.objects;

CREATE POLICY "Users can upload ID photos scoped to own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'id-verification'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
