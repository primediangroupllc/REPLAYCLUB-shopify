
CREATE TABLE public.slot_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_title text NOT NULL,
  booking_date date NOT NULL,
  booking_time text NOT NULL,
  locked_by_email text NOT NULL,
  stripe_session_id text,
  booking_id uuid,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT slot_locks_slot_unique UNIQUE (room_title, booking_date, booking_time)
);

CREATE INDEX slot_locks_expires_at_idx ON public.slot_locks (expires_at);

ALTER TABLE public.slot_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages slot locks"
  ON public.slot_locks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can read active slot locks"
  ON public.slot_locks
  FOR SELECT
  TO anon, authenticated
  USING (expires_at > now());

-- Atomic acquire. Race-safe via the unique constraint + ON CONFLICT DO UPDATE
-- that only takes effect when the existing lock is expired or owned by the same email.
CREATE OR REPLACE FUNCTION public.acquire_slot_lock(
  p_room_title text,
  p_booking_date date,
  p_booking_time text,
  p_email text,
  p_ttl_seconds integer DEFAULT 600
)
RETURNS TABLE(
  lock_id uuid,
  acquired boolean,
  conflict_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lock_id uuid;
  v_existing_paid boolean;
BEGIN
  -- Hard conflict: an actual paid/promo booking already exists.
  SELECT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE room_title = p_room_title
      AND booking_date = p_booking_date
      AND booking_time = p_booking_time
      AND payment_status IN ('paid', 'promo')
  ) INTO v_existing_paid;

  IF v_existing_paid THEN
    RETURN QUERY SELECT NULL::uuid, false, 'already_booked'::text;
    RETURN;
  END IF;

  -- Atomic acquire/refresh. The DO UPDATE clause's WHERE only fires when the
  -- existing lock is expired OR owned by the same email — so a different active
  -- holder will leave the row untouched and we'll detect the conflict below.
  INSERT INTO public.slot_locks (
    room_title, booking_date, booking_time,
    locked_by_email, expires_at
  )
  VALUES (
    p_room_title, p_booking_date, p_booking_time,
    p_email, now() + make_interval(secs => p_ttl_seconds)
  )
  ON CONFLICT (room_title, booking_date, booking_time) DO UPDATE
    SET locked_by_email = EXCLUDED.locked_by_email,
        expires_at = EXCLUDED.expires_at,
        created_at = now(),
        stripe_session_id = NULL,
        booking_id = NULL
    WHERE public.slot_locks.expires_at <= now()
       OR lower(public.slot_locks.locked_by_email) = lower(EXCLUDED.locked_by_email)
  RETURNING id INTO v_lock_id;

  IF v_lock_id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, false, 'locked_by_other'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT v_lock_id, true, NULL::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_slot_lock(p_lock_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.slot_locks WHERE id = p_lock_id;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_slot_available(
  p_room_title text,
  p_booking_date date,
  p_booking_time text,
  p_email text
)
RETURNS TABLE(
  available boolean,
  reason text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paid boolean;
  v_locked_by_other boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE room_title = p_room_title
      AND booking_date = p_booking_date
      AND booking_time = p_booking_time
      AND payment_status IN ('paid', 'promo')
  ) INTO v_paid;

  IF v_paid THEN
    RETURN QUERY SELECT false, 'already_booked'::text;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.slot_locks
    WHERE room_title = p_room_title
      AND booking_date = p_booking_date
      AND booking_time = p_booking_time
      AND expires_at > now()
      AND lower(locked_by_email) <> lower(p_email)
  ) INTO v_locked_by_other;

  IF v_locked_by_other THEN
    RETURN QUERY SELECT false, 'locked_by_other'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, NULL::text;
END;
$$;
