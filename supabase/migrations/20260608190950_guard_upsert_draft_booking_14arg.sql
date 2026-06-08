-- Audit #3 (corrected). The ownership guard added in
-- 20260513025725_upsert_draft_booking_email_ownership.sql landed on the 12-arg
-- overload — but the client had moved to the 14-arg overload (adds p_backdrop +
-- p_custom_requests) the day before (20260512024703). So the LIVE client path
-- has been the UNGUARDED 14-arg ever since: a non-service-role caller could
-- author a draft (insert a bookings row + hold a 30-min slot_lock) for an
-- ARBITRARY customer_email.
--
-- Fix (Option a): add the same ownership guard to the 14-arg IN PLACE, and DROP
-- the dead 12-arg so there is exactly ONE guarded function (no overload
-- ambiguity — the ambiguity is what caused this).
--
-- The body below is a VERBATIM copy of the live 14-arg definition
-- (pg_get_functiondef, pulled from prod 2026-06-08) with ONLY two additions:
--   (1) the `v_caller_email text;` DECLARE, and
--   (2) the auth.role()/JWT-email guard block at the top of BEGIN.
-- SECURITY DEFINER + SET search_path TO 'public' are preserved exactly
-- (CREATE OR REPLACE resets ALL properties, so they must be restated).

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
  v_lock_expiry timestamptz := now() + interval '30 minutes';
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

-- Defense-in-depth: only authenticated users + service_role should author drafts.
-- The guard above already blocks anon (no JWT email -> RAISE), but revoke EXECUTE
-- so anon can't even reach the function. authenticated + service_role keep their
-- explicit EXECUTE grants, so the live Layer-2 flow + any future edge wrapper work.
REVOKE EXECUTE ON FUNCTION public.upsert_draft_booking(
  text, date, text, text, text, text, text, jsonb, text, text, text, integer, text, text
) FROM anon, PUBLIC;

-- Drop the dead, unreachable 12-arg overload (carried the guard, had no caller).
-- A 12-arg-style call now resolves to the 14-arg above via its two DEFAULTs.
DROP FUNCTION IF EXISTS public.upsert_draft_booking(
  text, date, text, text, text, text, text, jsonb, text, text, text, integer
);
