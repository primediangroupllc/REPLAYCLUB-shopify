-- 1. Extend slot lock when user starts Stripe Identity verification.
--
-- Default: 30 minutes from now. Plenty of time for Stripe Identity to process
-- a document upload and for the user to return via /booking/return.
--
-- Releases happen elsewhere on terminal states:
--   * approved + paid  → slot_locks deleted by create-booking-payment / webhook
--   * rejected/canceled → release_slot_lock called from stripe-webhook
--
-- Ownership: caller must own the booking (by email) OR be the service role.
CREATE OR REPLACE FUNCTION public.extend_slot_lock_for_verification(
  p_booking_id uuid,
  p_extension_minutes integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room_title text;
  v_booking_date date;
  v_booking_time text;
  v_customer_email text;
  v_caller_email text;
  v_new_expiry timestamptz;
  v_updated int;
BEGIN
  IF p_extension_minutes IS NULL OR p_extension_minutes <= 0 OR p_extension_minutes > 240 THEN
    RAISE EXCEPTION 'invalid extension_minutes: %', p_extension_minutes;
  END IF;

  SELECT room_title, booking_date, booking_time, lower(customer_email)
    INTO v_room_title, v_booking_date, v_booking_time, v_customer_email
  FROM public.bookings
  WHERE id = p_booking_id;

  IF v_room_title IS NULL THEN
    RAISE EXCEPTION 'booking not found: %', p_booking_id;
  END IF;

  -- Authorization: service role bypasses; otherwise caller's JWT email must own.
  IF auth.role() <> 'service_role' THEN
    v_caller_email := lower(COALESCE(auth.jwt() ->> 'email', ''));
    IF v_caller_email = '' OR v_caller_email <> v_customer_email THEN
      RAISE EXCEPTION 'not authorized to extend lock for this booking';
    END IF;
  END IF;

  v_new_expiry := now() + (p_extension_minutes || ' minutes')::interval;

  -- Extend any active (non-expired) lock for this slot.
  UPDATE public.slot_locks
  SET expires_at = v_new_expiry,
      booking_id = COALESCE(booking_id, p_booking_id)
  WHERE room_title = v_room_title
    AND booking_date = v_booking_date
    AND booking_time = v_booking_time
    AND expires_at > now();

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Defensive: if no active lock, acquire one (slot may have just expired
  -- while user was on the Verify step). The unique constraint on the slot
  -- triple lets us upsert safely.
  IF v_updated = 0 THEN
    INSERT INTO public.slot_locks (
      room_title, booking_date, booking_time,
      locked_by_email, expires_at, booking_id
    )
    VALUES (
      v_room_title, v_booking_date, v_booking_time,
      v_customer_email, v_new_expiry, p_booking_id
    )
    ON CONFLICT (room_title, booking_date, booking_time)
    DO UPDATE SET
      expires_at = EXCLUDED.expires_at,
      locked_by_email = EXCLUDED.locked_by_email,
      booking_id = EXCLUDED.booking_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'expires_at', v_new_expiry,
    'booking_id', p_booking_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.extend_slot_lock_for_verification(uuid, integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.extend_slot_lock_for_verification(uuid, integer) TO authenticated, service_role;


-- 2. Patch upsert_draft_booking to ALSO ensure a slot_lock exists.
--
-- Edge case from spec: user gets rejected (under-18), the webhook releases the
-- slot_lock, then they try to re-verify with someone else's ID. Without this
-- patch they'd hold the booking row but no lock — another user could grab the
-- slot mid-flow. Acquiring the lock here closes the window.
--
-- Lock TTL: 30 minutes, matching the verification extension window.
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
BEGIN
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

    -- Re-acquire / extend slot lock if missing or expired (handles re-verify
    -- after rejection where the webhook released the lock).
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

  -- Acquire slot lock for the new draft.
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