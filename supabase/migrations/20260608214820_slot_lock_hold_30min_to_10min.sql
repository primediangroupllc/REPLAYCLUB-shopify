-- Shorten the slot-lock HOLD from 30 minutes to 10 minutes (Brian, 2026-06).
-- Rationale: a single-room studio (one DJ booth at a time) — a 30-min hold over-
-- protects an abandoned draft, blocking a time-specific slot for half an hour and
-- pushing the next user away. 10 min is enough for an attentive user to finish
-- Stripe Identity + consent + payment, but releases abandoned slots fast.
--
-- The hold duration is set ONLY in these two functions (slot_locks.expires_at has
-- NO column default live — verified 2026-06). Both bodies below are VERBATIM copies
-- of the live pg_get_functiondef with the SINGLE change `interval '30 minutes'` ->
-- `interval '10 minutes'`. CREATE OR REPLACE preserves existing grants (the anon
-- EXECUTE revoke on upsert_draft_booking stays) + the ownership guards + the
-- separate 24h verification_held_until window.

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
  p_amount_cents integer,
  p_backdrop text DEFAULT NULL::text,
  p_custom_requests text DEFAULT NULL::text
)
RETURNS TABLE(booking_id uuid, reused boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing uuid;
  v_new uuid;
  v_lock_expiry timestamptz := now() + interval '10 minutes';
  v_email text := lower(p_customer_email);
  v_caller_email text;
BEGIN
  -- Authorization: service_role bypasses; otherwise the caller's JWT email must
  -- match p_customer_email so a user can't author a draft for someone else's
  -- email. (Mirrors the guard that was mistakenly added to the dropped 12-arg.)
  IF auth.role() <> 'service_role' THEN
    v_caller_email := lower(COALESCE(auth.jwt() ->> 'email', ''));
    IF v_caller_email = '' OR v_caller_email <> v_email THEN
      RAISE EXCEPTION 'not authorized to author a draft for this email';
    END IF;
  END IF;

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
        backdrop = COALESCE(p_backdrop, backdrop),
        custom_requests = COALESCE(p_custom_requests, custom_requests),
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
    backdrop, custom_requests,
    amount_cents,
    payment_status,
    verification_status,
    verification_held_until
  )
  VALUES (
    p_room_title, p_booking_date, p_booking_time,
    p_customer_name, v_email, COALESCE(p_customer_phone, ''),
    p_tier, COALESCE(p_equipment, '[]'::jsonb), p_lighting, p_sound, p_layout,
    p_backdrop, p_custom_requests,
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
  p_amount_cents integer,
  p_backdrop text DEFAULT NULL::text,
  p_custom_requests text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_old_room text;
  v_old_date date;
  v_old_time text;
  v_email text;
  v_caller_email text;
  v_verification_status text;
  v_paid boolean;
  v_locked_by_other boolean;
  v_lock_expiry timestamptz := now() + interval '10 minutes';
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
      backdrop = COALESCE(p_backdrop, backdrop),
      custom_requests = COALESCE(p_custom_requests, custom_requests),
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
$function$;

-- Defense-in-depth: mirror the upsert_draft_booking anon-revoke from the 14-arg
-- guard migration. A SECURITY DEFINER booking-state-modifying function shouldn't
-- grant EXECUTE to anon/PUBLIC even though its ownership guard already blocks them.
-- authenticated + service_role retain EXECUTE (the live + edge paths still work).
REVOKE EXECUTE ON FUNCTION public.rebook_existing_booking(
  uuid, text, date, text, text, jsonb, text, text, text, integer, text, text
) FROM anon, PUBLIC;
