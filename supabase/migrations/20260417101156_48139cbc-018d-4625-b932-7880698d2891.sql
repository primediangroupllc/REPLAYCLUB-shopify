CREATE POLICY "Guests can upload ID photos to guest-invites folder"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'id-verification'
  AND (storage.foldername(name))[1] = 'guest-invites'
);