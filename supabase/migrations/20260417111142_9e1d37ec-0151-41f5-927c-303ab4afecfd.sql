-- Add consent fields to session_guests (per-guest consent on invite page)
ALTER TABLE public.session_guests
  ADD COLUMN IF NOT EXISTS consent_signature_path text,
  ADD COLUMN IF NOT EXISTS consent_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_signer_name text;

-- Add consent fields to equipment_rentals (rental customer consent)
ALTER TABLE public.equipment_rentals
  ADD COLUMN IF NOT EXISTS consent_signature_path text,
  ADD COLUMN IF NOT EXISTS consent_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_signer_name text;

-- Storage RLS: allow anonymous guests to upload signatures into the
-- guest-invites/ subfolder of the private consent-signatures bucket
-- (used by the public session invite page).
CREATE POLICY "Anyone can upload guest consent signatures"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'consent-signatures'
  AND (storage.foldername(name))[1] = 'guest-invites'
);

-- Allow authenticated rental customers to upload their consent signature
-- into the rentals/ subfolder, scoped to their own user id.
CREATE POLICY "Users can upload own rental consent signatures"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'consent-signatures'
  AND (storage.foldername(name))[1] = 'rentals'
  AND (storage.foldername(name))[2] = auth.uid()::text
);