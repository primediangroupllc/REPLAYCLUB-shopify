-- Audit #3 — upsert_draft_booking didn't verify the caller owns the email
-- they pass in. Any authenticated user could pass another customer's email
-- and either hijack their in-progress draft or attach an unrelated lock to
-- their slot. Mirrors the ownership check already in
-- extend_slot_lock_for_verification.
--
-- service_role bypasses (edge functions like upsert_draft_booking_secure
-- wrap this on behalf of unauthenticated booking flows).
CREATE OR REPLACE FUNCTION public.upsert_draft_booking(
  p_room_title text,
  p_booking_date date,
  p_booking_time text,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_tier text,
  p_equipment jsonb,
  p_lighting text,
  p_sound text,
  p_layout text,
  p_amount_cents integer
)
RETURNS TABLE(booking_id uuid, reused boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing uuid;
  v_new uuid;
  v_lock_expiry timestamptz := now() + interval '30 minutes';
  v_email text := lower(p_customer_email);
  v_caller_email text;
BEGIN
  -- Authorization: service role bypasses; otherwise the caller's JWT email
  -- must match p_customer_email so a user can't author a draft for someone
  -- else's email.
  IF auth.role() <> 'service_role' THEN
    v_caller_email := lower(COALESCE(auth.jwt() ->> 'email', ''));
    IF v_caller_email = '' OR v_caller_email <> v_email THEN
      RAISE EXCEPTION 'not authorized to author a draft for this email';
    END IF;
  END IF;

  -- Reuse any draft this customer already owns for this slot.
  SELECT id INTO v_existing
  FROM public.bookings
  WHERE lower(customer_email) = v_email
    AND room_title = p_room_title
    AND booking_date = p_booking_date
    AND booking_time = p_booking_time
    AND payment_status = 'pending'
    AND verification_status IN ('pending_id_upload', 'pending_ocr')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    UPDATE public.bookings
    SET customer_name = p_customer_name,
        customer_phone = COALESCE(NULLIF(p_customer_phone, ''), customer_phone),
        tier = COALESCE(p_tier, tier),
        equipment = COALESCE(p_equipment, equipment),
        lighting = COALESCE(p_lighting, lighting),
        sound = COALESCE(p_sound, sound),
        layout = COALESCE(p_layout, layout),
        amount_cents = p_amount_cents,
        verification_held_until = now() + interval '24 hours'
    WHERE id = v_existing;

    INSERT INTO public.slot_locks (
      room_title, booking_date, booking_time,
      locked_by_email, expires_at, booking_id
    )
    VALUES (
      p_room_title, p_booking_date, p_booking_time,
      v_email, v_lock_expiry, v_existing
    )
    ON CONFLICT (room_title, booking_date, booking_time)
    DO UPDATE SET
      expires_at = GREATEST(public.slot_locks.expires_at, EXCLUDED.expires_at),
      locked_by_email = EXCLUDED.locked_by_email,
      booking_id = EXCLUDED.booking_id
    WHERE public.slot_locks.locked_by_email = v_email
       OR public.slot_locks.expires_at <= now();

    RETURN QUERY SELECT v_existing, true;
    RETURN;
  END IF;

  INSERT INTO public.bookings (
    room_title, booking_date, booking_time,
    customer_name, customer_email, customer_phone,
    tier, equipment, lighting, sound, layout,
    amount_cents,
    payment_status,
    verification_status,
    verification_held_until
  )
  VALUES (
    p_room_title, p_booking_date, p_booking_time,
    p_customer_name, v_email, COALESCE(p_customer_phone, ''),
    p_tier, COALESCE(p_equipment, '[]'::jsonb), p_lighting, p_sound, p_layout,
    p_amount_cents,
    'pending',
    'pending_id_upload',
    now() + interval '24 hours'
  )
  RETURNING id INTO v_new;

  INSERT INTO public.slot_locks (
    room_title, booking_date, booking_time,
    locked_by_email, expires_at, booking_id
  )
  VALUES (
    p_room_title, p_booking_date, p_booking_time,
    v_email, v_lock_expiry, v_new
  )
  ON CONFLICT (room_title, booking_date, booking_time)
  DO UPDATE SET
    expires_at = GREATEST(public.slot_locks.expires_at, EXCLUDED.expires_at),
    locked_by_email = EXCLUDED.locked_by_email,
    booking_id = EXCLUDED.booking_id
  WHERE public.slot_locks.locked_by_email = v_email
     OR public.slot_locks.expires_at <= now();

  RETURN QUERY SELECT v_new, false;
END;
$function$;
