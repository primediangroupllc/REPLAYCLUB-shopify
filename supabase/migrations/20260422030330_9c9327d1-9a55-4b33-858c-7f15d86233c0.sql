-- Replace the simple trigger function with one that calls our edge function via pg_net
CREATE OR REPLACE FUNCTION public.handle_slot_lock_released()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paid_exists boolean;
  v_supabase_url text;
  v_anon_key text;
  v_has_waitlist boolean;
BEGIN
  -- Skip if a paid booking already replaced this lock
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

  -- Skip if no one is waiting
  SELECT EXISTS (
    SELECT 1 FROM public.waitlist
    WHERE room_title = OLD.room_title
      AND booking_date = OLD.booking_date
      AND booking_time = OLD.booking_time
      AND notified = false
  ) INTO v_has_waitlist;

  IF NOT v_has_waitlist THEN
    RETURN OLD;
  END IF;

  -- Pull config
  BEGIN
    SELECT decrypted_secret INTO v_supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
    SELECT decrypted_secret INTO v_anon_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    -- vault not accessible; just mark as notified to keep state sane
    PERFORM public.notify_waitlist_for_slot(OLD.room_title, OLD.booking_date, OLD.booking_time);
    RETURN OLD;
  END;

  IF v_supabase_url IS NULL OR v_anon_key IS NULL THEN
    PERFORM public.notify_waitlist_for_slot(OLD.room_title, OLD.booking_date, OLD.booking_time);
    RETURN OLD;
  END IF;

  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/notify-waitlist-on-slot-release',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key
    ),
    body := jsonb_build_object(
      'roomTitle', OLD.room_title,
      'bookingDate', OLD.booking_date,
      'bookingTime', OLD.booking_time
    )
  );

  RETURN OLD;
END;
$$;