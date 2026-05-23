-- Find or create a draft booking row for a customer + slot. Idempotent:
-- if the same customer email already has a non-paid booking for this exact
-- slot, return it instead of inserting a new row. This protects against
-- duplicate drafts when the user reloads the Verify page or hits back.
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
SET search_path = public
AS $$
DECLARE
  v_existing uuid;
  v_new uuid;
BEGIN
  -- Reuse any draft this customer already owns for this slot.
  SELECT id INTO v_existing
  FROM public.bookings
  WHERE lower(customer_email) = lower(p_customer_email)
    AND room_title = p_room_title
    AND booking_date = p_booking_date
    AND booking_time = p_booking_time
    AND payment_status = 'pending'
    AND verification_status IN ('pending_id_upload', 'pending_ocr')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    -- Refresh the hold window and overwrite mutable fields in case the
    -- customer changed something between attempts.
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
    p_customer_name, lower(p_customer_email), COALESCE(p_customer_phone, ''),
    p_tier, COALESCE(p_equipment, '[]'::jsonb), p_lighting, p_sound, p_layout,
    p_amount_cents,
    'pending',
    'pending_id_upload',
    now() + interval '24 hours'
  )
  RETURNING id INTO v_new;

  RETURN QUERY SELECT v_new, false;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_draft_booking(
  text, date, text, text, text, text, text, jsonb, text, text, text, integer
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_draft_booking(
  text, date, text, text, text, text, text, jsonb, text, text, text, integer
) TO authenticated, service_role;

-- Sweep: mark drafts whose 24h verification hold has elapsed as expired.
-- We keep the row for audit / abandoned-conversion analytics rather than
-- hard-deleting it.
CREATE OR REPLACE FUNCTION public.expire_abandoned_draft_bookings()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  WITH updated AS (
    UPDATE public.bookings
    SET verification_status = 'expired',
        verification_held_until = NULL
    WHERE payment_status = 'pending'
      AND verification_status IN ('pending_id_upload', 'pending_ocr')
      AND verification_held_until IS NOT NULL
      AND verification_held_until < now()
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.expire_abandoned_draft_bookings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expire_abandoned_draft_bookings() TO service_role;

-- Index speeds up the nightly sweep.
CREATE INDEX IF NOT EXISTS idx_bookings_pending_verification_held
  ON public.bookings (verification_held_until)
  WHERE payment_status = 'pending'
    AND verification_status IN ('pending_id_upload', 'pending_ocr');