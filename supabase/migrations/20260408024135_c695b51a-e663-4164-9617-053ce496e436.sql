
-- Add id_photo_url and id_verified columns to bookings
ALTER TABLE public.bookings 
  ADD COLUMN IF NOT EXISTS id_photo_url text,
  ADD COLUMN IF NOT EXISTS id_verified text DEFAULT 'pending';

-- Create private storage bucket for ID photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('id-verification', 'id-verification', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own ID photos
CREATE POLICY "Users can upload ID photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'id-verification');

-- Allow admins to read ID photos
CREATE POLICY "Admins can read ID photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'id-verification' AND public.has_role(auth.uid(), 'admin'));

-- Allow service role full access to ID photos
CREATE POLICY "Service role manages ID photos"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'id-verification')
WITH CHECK (bucket_id = 'id-verification');

-- Auto-delete ID photos after 48 hours (will be handled by edge function/cron)
