
-- Create storage bucket for roster submissions
INSERT INTO storage.buckets (id, name, public) VALUES ('roster-submissions', 'roster-submissions', false);

-- Allow anyone to upload to roster-submissions
CREATE POLICY "Anyone can upload roster submissions"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'roster-submissions');

-- Allow service role to read roster submissions (for admin)
CREATE POLICY "Admins can read roster submissions"
ON storage.objects FOR SELECT
USING (bucket_id = 'roster-submissions' AND auth.role() = 'authenticated' AND public.has_role(auth.uid(), 'admin'));
