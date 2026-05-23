-- Fix consent-signatures upload policy: match the actual client path which uses invite.id (UUID), not token
DROP POLICY IF EXISTS "Guests can upload consent signatures with valid invite token" ON storage.objects;

CREATE POLICY "Guests can upload consent signatures for valid invites"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'consent-signatures'
  AND (storage.foldername(name))[1] = 'guest-invites'
  AND EXISTS (
    SELECT 1 FROM public.session_invites si
    WHERE si.id::text = (storage.foldername(name))[2]
  )
);

-- Mask referred_email from referrers: drop the broad SELECT policy
-- Referrers should use the get_referral_credits() RPC for aggregate stats instead of reading raw rows
DROP POLICY IF EXISTS "Users can read own referrals" ON public.referrals;

-- Note: get_referral_credits(user_id uuid) RPC already exists and is SECURITY DEFINER,
-- returning only counts and credit amounts (no PII). Frontend should use that.