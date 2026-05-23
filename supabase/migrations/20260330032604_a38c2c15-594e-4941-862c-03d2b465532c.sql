-- Fix mixes storage: scope reads to file owner (path starts with user_id)
DROP POLICY "Authenticated can read mixes" ON storage.objects;

CREATE POLICY "Users can read own mixes" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'mixes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Admins can read all mixes" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'mixes'
    AND has_role(auth.uid(), 'admin'::app_role)
  );