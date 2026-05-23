
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS consent_signature_path text,
  ADD COLUMN IF NOT EXISTS consent_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_signer_name text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('consent-signatures', 'consent-signatures', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload own consent signatures"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'consent-signatures'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users read own consent signatures"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'consent-signatures'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Admins read all consent signatures"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'consent-signatures'
  AND public.has_role(auth.uid(), 'admin')
);
