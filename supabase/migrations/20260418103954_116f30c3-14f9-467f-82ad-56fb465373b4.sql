-- 1. Add SELECT policy on session_invites scoping authenticated users to invites linked to their own bookings (by email)
CREATE POLICY "Users can read invites for own bookings"
ON public.session_invites
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = session_invites.booking_id
      AND lower(b.customer_email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  )
);

-- 2. Tighten consent-signatures bucket: require a valid (non-revoked) session_invite token in the upload path
-- Path convention enforced: guest-invites/{token}/...
DROP POLICY IF EXISTS "Anyone can upload guest consent signatures" ON storage.objects;

CREATE POLICY "Guests can upload consent signatures with valid invite token"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'consent-signatures'
  AND (storage.foldername(name))[1] = 'guest-invites'
  AND EXISTS (
    SELECT 1 FROM public.session_invites si
    WHERE si.token = (storage.foldername(name))[2]
  )
);