CREATE OR REPLACE FUNCTION public.get_session_invite_by_booking(p_booking_id uuid)
RETURNS SETOF public.session_invites
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT si.* FROM public.session_invites si
  INNER JOIN public.bookings b ON b.id = si.booking_id
  WHERE si.booking_id = p_booking_id
  AND lower(b.customer_email) = lower(
    (SELECT email FROM auth.users WHERE id = auth.uid())
  )
  LIMIT 1;
$$;