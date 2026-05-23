INSERT INTO storage.buckets (id, name, public)
VALUES ('event-covers', 'event-covers', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view event covers"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'event-covers');

CREATE POLICY "Admins can upload event covers"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'event-covers' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update event covers"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'event-covers' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete event covers"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'event-covers' AND public.has_role(auth.uid(), 'admin'));