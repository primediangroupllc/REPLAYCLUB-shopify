
-- =========================================================
-- C1: slot_locks — hide locked_by_email from public
-- =========================================================
DROP POLICY IF EXISTS "Anyone can read active slot locks" ON public.slot_locks;
DROP POLICY IF EXISTS "Public can read active slot locks" ON public.slot_locks;

-- Public availability view (no email column)
CREATE OR REPLACE VIEW public.slot_locks_public AS
SELECT id, room_title, booking_date, booking_time, expires_at, created_at
FROM public.slot_locks
WHERE expires_at > now();

GRANT SELECT ON public.slot_locks_public TO anon, authenticated;

-- Owner / admin can still read their own full row
CREATE POLICY "Owners read own slot locks"
ON public.slot_locks
FOR SELECT
TO authenticated
USING (
  lower(locked_by_email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- =========================================================
-- C2: equipment_locks — hide locked_by_email from public
-- =========================================================
DROP POLICY IF EXISTS "Anyone can read active equipment locks" ON public.equipment_locks;

CREATE OR REPLACE VIEW public.equipment_locks_public AS
SELECT id, equipment_name, pickup_date, rental_days, expires_at, created_at
FROM public.equipment_locks
WHERE expires_at > now();

GRANT SELECT ON public.equipment_locks_public TO anon, authenticated;

CREATE POLICY "Owners read own equipment locks"
ON public.equipment_locks
FOR SELECT
TO authenticated
USING (
  lower(locked_by_email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- =========================================================
-- W1: challenge_votes — restrict reads to voter/admin
-- =========================================================
DROP POLICY IF EXISTS "Authenticated users can read votes" ON public.challenge_votes;

CREATE POLICY "Voters read own votes"
ON public.challenge_votes
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- =========================================================
-- W2: session_messages — restrict reads to invite participants
-- =========================================================
DROP POLICY IF EXISTS "Anyone can read session messages" ON public.session_messages;
DROP POLICY IF EXISTS "Public read session messages" ON public.session_messages;

-- RPC: fetch messages by invite token (token acts as participant proof)
CREATE OR REPLACE FUNCTION public.get_session_messages_by_token(p_token text)
RETURNS SETOF public.session_messages
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.*
  FROM public.session_messages m
  JOIN public.session_invites si ON si.id = m.session_invite_id
  WHERE si.token = p_token
  ORDER BY m.created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_session_messages_by_token(text) TO anon, authenticated;

-- Booking owner / admin can read directly
CREATE POLICY "Booking owner reads session messages"
ON public.session_messages
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.session_invites si
    JOIN public.bookings b ON b.id = si.booking_id
    WHERE si.id = session_messages.session_invite_id
      AND lower(b.customer_email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  )
);

-- =========================================================
-- W3: referrals — owner-scoped read policy
-- =========================================================
CREATE POLICY "Referrers read own referrals"
ON public.referrals
FOR SELECT
TO authenticated
USING (auth.uid() = referrer_id OR has_role(auth.uid(), 'admin'::app_role));

-- =========================================================
-- W4: challenge-clips storage — lock down writes
-- =========================================================
DROP POLICY IF EXISTS "Anyone can upload challenge clips" ON storage.objects;
DROP POLICY IF EXISTS "Public upload challenge clips" ON storage.objects;

CREATE POLICY "Users upload own challenge clips"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'challenge-clips'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users update own challenge clips"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'challenge-clips'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users delete own challenge clips"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'challenge-clips'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Public read remains via bucket public flag
