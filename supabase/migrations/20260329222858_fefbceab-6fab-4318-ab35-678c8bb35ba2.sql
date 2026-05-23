
-- Create mixes storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('mixes', 'mixes', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: admins can upload mixes
CREATE POLICY "Admins can upload mixes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'mixes' AND
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Storage policy: anyone authenticated can read mixes
CREATE POLICY "Authenticated can read mixes"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'mixes');

-- Allow admins to manage mixes table
CREATE POLICY "Admins can manage mixes"
ON public.mixes FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
