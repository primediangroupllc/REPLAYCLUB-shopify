
CREATE POLICY "Admins can delete mixes"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'mixes' AND
  public.has_role(auth.uid(), 'admin'::public.app_role)
);
