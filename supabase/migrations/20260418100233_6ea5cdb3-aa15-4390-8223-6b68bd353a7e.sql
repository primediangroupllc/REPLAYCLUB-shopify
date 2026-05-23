
-- 1. Tighten session_guests RLS — remove public SELECT
DROP POLICY IF EXISTS "Anyone can read session guests" ON public.session_guests;

CREATE POLICY "Admins can read session guests"
ON public.session_guests
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Prevent double-booking race condition
-- Remove any existing duplicates first to allow index creation
-- (Keep the earliest paid/promo per slot)
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY room_title, booking_date, booking_time
      ORDER BY created_at ASC
    ) AS rn
  FROM public.bookings
  WHERE payment_status IN ('paid', 'promo')
)
UPDATE public.bookings b
SET payment_status = 'duplicate_void'
FROM ranked r
WHERE b.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_unique_paid_slot_idx
ON public.bookings (room_title, booking_date, booking_time)
WHERE payment_status IN ('paid', 'promo');

-- 3. Atomic event RSVP confirm with capacity check
CREATE OR REPLACE FUNCTION public.confirm_event_rsvp_with_capacity(
  p_rsvp_id uuid,
  p_ticket_code text
)
RETURNS TABLE (
  success boolean,
  over_capacity boolean,
  already_confirmed boolean,
  rsvp_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_capacity int;
  v_confirmed_count int;
  v_current_status text;
BEGIN
  -- Lock the rsvp row
  SELECT event_id, payment_status
    INTO v_event_id, v_current_status
  FROM bookings_dummy_skip
  WHERE false;

  SELECT event_id, payment_status
    INTO v_event_id, v_current_status
  FROM event_rsvps
  WHERE id = p_rsvp_id
  FOR UPDATE;

  IF v_event_id IS NULL THEN
    RETURN QUERY SELECT false, false, false, p_rsvp_id;
    RETURN;
  END IF;

  IF v_current_status = 'paid' THEN
    RETURN QUERY SELECT true, false, true, p_rsvp_id;
    RETURN;
  END IF;

  -- Lock event and count confirmed
  SELECT capacity INTO v_capacity FROM events WHERE id = v_event_id FOR UPDATE;

  SELECT COUNT(*) INTO v_confirmed_count
  FROM event_rsvps
  WHERE event_id = v_event_id
    AND payment_status = 'paid'
    AND status = 'confirmed';

  IF v_confirmed_count >= v_capacity THEN
    -- Mark as waitlist instead
    UPDATE event_rsvps
    SET status = 'waitlist',
        payment_status = 'refund_pending'
    WHERE id = p_rsvp_id;
    RETURN QUERY SELECT false, true, false, p_rsvp_id;
    RETURN;
  END IF;

  UPDATE event_rsvps
  SET status = 'confirmed',
      payment_status = 'paid',
      ticket_code = COALESCE(ticket_code, p_ticket_code)
  WHERE id = p_rsvp_id;

  RETURN QUERY SELECT true, false, false, p_rsvp_id;
END;
$$;
