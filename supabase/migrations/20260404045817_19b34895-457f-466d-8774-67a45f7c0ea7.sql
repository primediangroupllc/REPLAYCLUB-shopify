
INSERT INTO storage.buckets (id, name, public)
VALUES ('talent-images', 'talent-images', true);

CREATE POLICY "Anyone can read talent images"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'talent-images');

CREATE POLICY "Admins can upload talent images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'talent-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update talent images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'talent-images' AND public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (bucket_id = 'talent-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete talent images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'talent-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));
