CREATE OR REPLACE FUNCTION public.rebook_existing_booking(
  p_booking_id uuid,
  p_room_title text,
  p_booking_date date,
  p_booking_time text,
  p_tier text,
  p_equipment jsonb,
  p_lighting text,
  p_sound text,
  p_layout text,
  p_amount_cents integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_room text;
  v_old_date date;
  v_old_time text;
  v_email text;
  v_caller_email text;
  v_verification_status text;
  v_paid boolean;
  v_locked_by_other boolean;
  v_lock_expiry timestamptz := now() + interval '30 minutes';
BEGIN
  SELECT room_title, booking_date, booking_time,
         lower(customer_email), verification_status
    INTO v_old_room, v_old_date, v_old_time, v_email, v_verification_status
  FROM public.bookings
  WHERE id = p_booking_id;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'booking not found: %', p_booking_id;
  END IF;

  IF v_verification_status <> 'approved' THEN
    RAISE EXCEPTION 'rebook only allowed for approved bookings (got: %)', v_verification_status;
  END IF;

  IF auth.role() <> 'service_role' THEN
    v_caller_email := lower(COALESCE(auth.jwt() ->> 'email', ''));
    IF v_caller_email = '' OR v_caller_email <> v_email THEN
      RAISE EXCEPTION 'not authorized to rebook this booking';
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE room_title = p_room_title
      AND booking_date = p_booking_date
      AND booking_time = p_booking_time
      AND payment_status IN ('paid', 'promo')
      AND id <> p_booking_id
  ) INTO v_paid;
  IF v_paid THEN
    RAISE EXCEPTION 'slot_already_booked';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.slot_locks
    WHERE room_title = p_room_title
      AND booking_date = p_booking_date
      AND booking_time = p_booking_time
      AND expires_at > now()
      AND lower(locked_by_email) <> v_email
      AND COALESCE(booking_id, '00000000-0000-0000-0000-000000000000'::uuid) <> p_booking_id
  ) INTO v_locked_by_other;
  IF v_locked_by_other THEN
    RAISE EXCEPTION 'slot_locked_by_other';
  END IF;

  UPDATE public.bookings
  SET room_title = p_room_title,
      booking_date = p_booking_date,
      booking_time = p_booking_time,
      tier = COALESCE(p_tier, tier),
      equipment = COALESCE(p_equipment, equipment),
      lighting = COALESCE(p_lighting, lighting),
      sound = COALESCE(p_sound, sound),
      layout = COALESCE(p_layout, layout),
      amount_cents = p_amount_cents
  WHERE id = p_booking_id;

  IF v_old_room IS NOT NULL AND v_old_date IS NOT NULL AND v_old_time IS NOT NULL
     AND (v_old_room <> p_room_title OR v_old_date <> p_booking_date OR v_old_time <> p_booking_time)
  THEN
    DELETE FROM public.slot_locks
    WHERE room_title = v_old_room
      AND booking_date = v_old_date
      AND booking_time = v_old_time
      AND lower(locked_by_email) = v_email;
  END IF;

  INSERT INTO public.slot_locks (
    room_title, booking_date, booking_time,
    locked_by_email, expires_at, booking_id
  )
  VALUES (
    p_room_title, p_booking_date, p_booking_time,
    v_email, v_lock_expiry, p_booking_id
  )
  ON CONFLICT (room_title, booking_date, booking_time)
  DO UPDATE SET
    expires_at = GREATEST(public.slot_locks.expires_at, EXCLUDED.expires_at),
    locked_by_email = EXCLUDED.locked_by_email,
    booking_id = EXCLUDED.booking_id
  WHERE public.slot_locks.locked_by_email = v_email
     OR public.slot_locks.expires_at <= now();

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'lock_expires_at', v_lock_expiry
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rebook_existing_booking(
  uuid, text, date, text, text, jsonb, text, text, text, integer
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rebook_existing_booking(
  uuid, text, date, text, text, jsonb, text, text, text, integer
) TO authenticated, service_role;