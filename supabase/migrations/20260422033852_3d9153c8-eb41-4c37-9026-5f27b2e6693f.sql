
-- ============================================================================
-- Hardening pack: webhook log, rate limit, abandonment, integrity, cleanup
-- ============================================================================

-- 1. Webhook events log (Stripe replay/debug)
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'stripe',
  event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'received',  -- received | processed | failed | replayed
  error_message text,
  attempts int NOT NULL DEFAULT 0,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON public.webhook_events (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON public.webhook_events (event_type, created_at DESC);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read webhook events"
  ON public.webhook_events FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages webhook events"
  ON public.webhook_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 6. Server-side rate limiting (ad-hoc DB counter)
CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket text NOT NULL,            -- e.g. 'create-booking-payment'
  identifier text NOT NULL,        -- ip or email
  window_start timestamptz NOT NULL,
  count int NOT NULL DEFAULT 1,
  UNIQUE (bucket, identifier, window_start)
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_window ON public.rate_limit_counters (window_start);

ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages rate limits"
  ON public.rate_limit_counters FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_bucket text,
  p_identifier text,
  p_max int,
  p_window_seconds int
)
RETURNS TABLE(allowed boolean, current_count int, retry_after_seconds int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamptz;
  v_count int;
BEGIN
  -- Bucketize window to multiples of p_window_seconds for clean counters
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  INSERT INTO public.rate_limit_counters (bucket, identifier, window_start, count)
  VALUES (p_bucket, lower(p_identifier), v_window_start, 1)
  ON CONFLICT (bucket, identifier, window_start) DO UPDATE
    SET count = public.rate_limit_counters.count + 1
  RETURNING count INTO v_count;

  IF v_count > p_max THEN
    RETURN QUERY SELECT false, v_count,
      GREATEST(1, p_window_seconds - extract(epoch from (now() - v_window_start))::int);
  ELSE
    RETURN QUERY SELECT true, v_count, 0;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_counters()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  WITH d AS (
    DELETE FROM public.rate_limit_counters
    WHERE window_start < now() - interval '1 day' RETURNING 1
  )
  SELECT count(*) INTO v_count FROM d;
  RETURN v_count;
END;
$$;

-- 4. Abandonment recovery tracking
CREATE TABLE IF NOT EXISTS public.abandoned_checkouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  service text NOT NULL,           -- 'booking' | 'equipment' | 'event' | 'gift_card'
  context jsonb,                    -- room/date/time or items
  lock_id uuid,
  expired_at timestamptz NOT NULL DEFAULT now(),
  recovery_email_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_abandoned_checkouts_unsent
  ON public.abandoned_checkouts (recovery_email_sent_at, expired_at)
  WHERE recovery_email_sent_at IS NULL;

ALTER TABLE public.abandoned_checkouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read abandoned checkouts"
  ON public.abandoned_checkouts FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role manages abandoned checkouts"
  ON public.abandoned_checkouts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 8. Failure report categorization
ALTER TABLE public.failure_reports
  ADD COLUMN IF NOT EXISTS category text;

CREATE OR REPLACE FUNCTION public.categorize_failure_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_msg text;
BEGIN
  v_msg := lower(coalesce(NEW.error_message, '') || ' ' || coalesce(NEW.stage, ''));
  IF NEW.category IS NULL OR NEW.category = '' THEN
    NEW.category := CASE
      WHEN v_msg ~ '(stripe|card_declined|payment_intent|3ds|checkout)' THEN 'stripe'
      WHEN v_msg ~ '(locked_by_other|already_booked|lock_conflict|slot_lock)' THEN 'lock_conflict'
      WHEN v_msg ~ '(network|timeout|fetch failed|econnreset|abort)' THEN 'network'
      WHEN v_msg ~ '(invalid|required|not authenticated|unauthorized|forbidden|validation)' THEN 'validation'
      WHEN v_msg ~ '(verify|captcha|hcaptcha|id_photo|consent)' THEN 'verification'
      ELSE 'other'
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_categorize_failure_report ON public.failure_reports;
CREATE TRIGGER trg_categorize_failure_report
  BEFORE INSERT ON public.failure_reports
  FOR EACH ROW EXECUTE FUNCTION public.categorize_failure_report();

-- 12. Integrity snapshots
CREATE TABLE IF NOT EXISTS public.integrity_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date NOT NULL DEFAULT (now()::date),
  bookings_count int NOT NULL DEFAULT 0,
  paid_bookings_count int NOT NULL DEFAULT 0,
  rentals_count int NOT NULL DEFAULT 0,
  mixes_count int NOT NULL DEFAULT 0,
  users_count int NOT NULL DEFAULT 0,
  events_count int NOT NULL DEFAULT 0,
  rsvps_count int NOT NULL DEFAULT 0,
  gift_cards_count int NOT NULL DEFAULT 0,
  failure_reports_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (snapshot_date)
);

ALTER TABLE public.integrity_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read integrity snapshots"
  ON public.integrity_snapshots FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role manages integrity snapshots"
  ON public.integrity_snapshots FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.capture_integrity_snapshot()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.integrity_snapshots (
    snapshot_date,
    bookings_count, paid_bookings_count, rentals_count, mixes_count,
    users_count, events_count, rsvps_count, gift_cards_count, failure_reports_count
  )
  VALUES (
    now()::date,
    (SELECT count(*) FROM public.bookings),
    (SELECT count(*) FROM public.bookings WHERE payment_status IN ('paid','promo')),
    (SELECT count(*) FROM public.equipment_rentals),
    (SELECT count(*) FROM public.mixes),
    (SELECT count(*) FROM auth.users),
    (SELECT count(*) FROM public.events),
    (SELECT count(*) FROM public.event_rsvps),
    (SELECT count(*) FROM public.gift_cards),
    (SELECT count(*) FROM public.failure_reports)
  )
  ON CONFLICT (snapshot_date) DO UPDATE SET
    bookings_count = EXCLUDED.bookings_count,
    paid_bookings_count = EXCLUDED.paid_bookings_count,
    rentals_count = EXCLUDED.rentals_count,
    mixes_count = EXCLUDED.mixes_count,
    users_count = EXCLUDED.users_count,
    events_count = EXCLUDED.events_count,
    rsvps_count = EXCLUDED.rsvps_count,
    gift_cards_count = EXCLUDED.gift_cards_count,
    failure_reports_count = EXCLUDED.failure_reports_count
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- 4. Capture abandonment when slot lock expires (BEFORE the trigger that notifies waitlist).
CREATE OR REPLACE FUNCTION public.capture_abandoned_slot_lock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_paid boolean;
BEGIN
  -- Only capture if it actually expired (not manually released via paid booking)
  IF OLD.expires_at > now() THEN
    RETURN OLD;
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE room_title = OLD.room_title
      AND booking_date = OLD.booking_date
      AND booking_time = OLD.booking_time
      AND payment_status IN ('paid','promo')
  ) INTO v_paid;
  IF v_paid THEN RETURN OLD; END IF;

  INSERT INTO public.abandoned_checkouts (email, service, context, lock_id, expired_at)
  VALUES (
    OLD.locked_by_email,
    'booking',
    jsonb_build_object(
      'room_title', OLD.room_title,
      'booking_date', OLD.booking_date,
      'booking_time', OLD.booking_time
    ),
    OLD.id,
    OLD.expires_at
  );
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_capture_abandoned_slot_lock ON public.slot_locks;
CREATE TRIGGER trg_capture_abandoned_slot_lock
  BEFORE DELETE ON public.slot_locks
  FOR EACH ROW EXECUTE FUNCTION public.capture_abandoned_slot_lock();

-- 3. Cron jobs (auto-cleanup + integrity + abandonment + failure digest)
DO $$
BEGIN
  -- pg_cron must be installed; safe IF EXISTS guard
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Hourly: slot lock cleanup
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'cleanup-slot-locks-hourly';
    PERFORM cron.schedule('cleanup-slot-locks-hourly', '0 * * * *',
      $cron$ SELECT public.cleanup_expired_slot_locks(); $cron$);

    -- Hourly: stripe idempotency cleanup
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'cleanup-stripe-idempotency-hourly';
    PERFORM cron.schedule('cleanup-stripe-idempotency-hourly', '15 * * * *',
      $cron$ SELECT public.cleanup_expired_stripe_idempotency(); $cron$);

    -- Daily: rate-limit counter cleanup
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'cleanup-rate-limits-daily';
    PERFORM cron.schedule('cleanup-rate-limits-daily', '30 3 * * *',
      $cron$ SELECT public.cleanup_rate_limit_counters(); $cron$);

    -- Weekly: integrity snapshot (Sunday 04:00 UTC)
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'integrity-snapshot-weekly';
    PERFORM cron.schedule('integrity-snapshot-weekly', '0 4 * * 0',
      $cron$ SELECT public.capture_integrity_snapshot(); $cron$);
  END IF;
END $$;
