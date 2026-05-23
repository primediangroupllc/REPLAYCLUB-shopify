-- 1. Enable required extensions for cron + http calls
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Cleanup function for expired locks
CREATE OR REPLACE FUNCTION public.cleanup_expired_slot_locks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  WITH deleted AS (
    DELETE FROM public.slot_locks
    WHERE expires_at <= now()
    RETURNING id
  )
  SELECT count(*) INTO v_deleted FROM deleted;
  RETURN v_deleted;
END;
$$;

-- Schedule cleanup every 5 minutes (idempotent — drop existing job first)
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-expired-slot-locks');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'cleanup-expired-slot-locks',
  '*/5 * * * *',
  $$ SELECT public.cleanup_expired_slot_locks(); $$
);

-- 3. Equipment locks table (per-item, per-pickup-date)
CREATE TABLE IF NOT EXISTS public.equipment_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_name text NOT NULL,
  pickup_date date NOT NULL,
  rental_days integer NOT NULL DEFAULT 1,
  locked_by_email text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT equipment_locks_unique UNIQUE (equipment_name, pickup_date, locked_by_email)
);

CREATE INDEX IF NOT EXISTS equipment_locks_expires_idx ON public.equipment_locks (expires_at);
CREATE INDEX IF NOT EXISTS equipment_locks_lookup_idx ON public.equipment_locks (equipment_name, pickup_date);

ALTER TABLE public.equipment_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages equipment locks"
  ON public.equipment_locks FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can read active equipment locks"
  ON public.equipment_locks FOR SELECT
  TO anon, authenticated
  USING (expires_at > now());

-- Acquire equipment lock for a single item (one row per item per pickup_date per holder)
CREATE OR REPLACE FUNCTION public.acquire_equipment_lock(
  p_equipment_name text,
  p_pickup_date date,
  p_rental_days integer,
  p_email text,
  p_ttl_seconds integer DEFAULT 600
)
RETURNS TABLE(lock_id uuid, acquired boolean, conflict_reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lock_id uuid;
  v_conflict boolean;
BEGIN
  -- Other active locks for this item on overlapping dates (excluding self)
  SELECT EXISTS (
    SELECT 1 FROM public.equipment_locks
    WHERE equipment_name = p_equipment_name
      AND expires_at > now()
      AND lower(locked_by_email) <> lower(p_email)
      AND daterange(pickup_date, pickup_date + rental_days, '[)')
          && daterange(p_pickup_date, p_pickup_date + p_rental_days, '[)')
  ) INTO v_conflict;

  IF v_conflict THEN
    RETURN QUERY SELECT NULL::uuid, false, 'locked_by_other'::text;
    RETURN;
  END IF;

  INSERT INTO public.equipment_locks (
    equipment_name, pickup_date, rental_days, locked_by_email, expires_at
  )
  VALUES (
    p_equipment_name, p_pickup_date, p_rental_days, p_email,
    now() + make_interval(secs => p_ttl_seconds)
  )
  ON CONFLICT (equipment_name, pickup_date, locked_by_email) DO UPDATE
    SET expires_at = EXCLUDED.expires_at,
        rental_days = EXCLUDED.rental_days,
        created_at = now()
  RETURNING id INTO v_lock_id;

  RETURN QUERY SELECT v_lock_id, true, NULL::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_equipment_locks(p_lock_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH deleted AS (
    DELETE FROM public.equipment_locks WHERE id = ANY(p_lock_ids) RETURNING id
  )
  SELECT count(*) INTO v_count FROM deleted;
  RETURN v_count;
END;
$$;

-- 4. Waitlist promote helper: when a slot lock expires/releases, notify waitlist.
-- Returns the number of users notified.
CREATE OR REPLACE FUNCTION public.notify_waitlist_for_slot(
  p_room_title text,
  p_booking_date date,
  p_booking_time text
)
RETURNS TABLE(notified_id uuid, user_email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.waitlist
  SET notified = true, notified_at = now()
  WHERE room_title = p_room_title
    AND booking_date = p_booking_date
    AND booking_time = p_booking_time
    AND notified = false
  RETURNING id, waitlist.user_email;
END;
$$;

-- 5. Trigger: when a slot_lock is deleted (released or expired by cleanup), notify waitlist
CREATE OR REPLACE FUNCTION public.handle_slot_lock_released()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paid_exists boolean;
BEGIN
  -- Don't notify if a paid booking now occupies the slot (lock was deleted by webhook).
  SELECT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE room_title = OLD.room_title
      AND booking_date = OLD.booking_date
      AND booking_time = OLD.booking_time
      AND payment_status IN ('paid', 'promo')
  ) INTO v_paid_exists;

  IF v_paid_exists THEN
    RETURN OLD;
  END IF;

  PERFORM public.notify_waitlist_for_slot(OLD.room_title, OLD.booking_date, OLD.booking_time);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS slot_lock_released_trigger ON public.slot_locks;
CREATE TRIGGER slot_lock_released_trigger
  AFTER DELETE ON public.slot_locks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_slot_lock_released();