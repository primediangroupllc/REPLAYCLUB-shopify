
-- 1) Failure-report digest table (used by reportBookingFailure)
CREATE TABLE IF NOT EXISTS public.failure_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage text NOT NULL,
  error_message text NOT NULL,
  service text,
  booking_date date,
  booking_time text,
  customer_name text,
  customer_email text,
  amount_cents integer,
  stripe_session_id text,
  booking_id uuid,
  route text,
  user_agent text,
  viewport text,
  console_log text,
  network_log text,
  digest_sent boolean NOT NULL DEFAULT false,
  digest_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.failure_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages failure reports"
  ON public.failure_reports FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Admins can read failure reports"
  ON public.failure_reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Anonymous users can insert failure reports (so client-side reporter works without auth race)
CREATE POLICY "Anyone can insert failure reports"
  ON public.failure_reports FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_failure_reports_pending
  ON public.failure_reports (digest_sent, created_at)
  WHERE digest_sent = false;

-- 2) Stripe payment-intent idempotency table (booking-side double-click guard)
CREATE TABLE IF NOT EXISTS public.stripe_checkout_idempotency (
  idempotency_key text PRIMARY KEY,
  stripe_session_id text NOT NULL,
  stripe_session_url text NOT NULL,
  booking_id uuid,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 minutes',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_checkout_idempotency ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages idempotency"
  ON public.stripe_checkout_idempotency FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3) Cleanup expired idempotency rows
CREATE OR REPLACE FUNCTION public.cleanup_expired_stripe_idempotency()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  WITH d AS (
    DELETE FROM public.stripe_checkout_idempotency WHERE expires_at <= now() RETURNING 1
  )
  SELECT count(*) INTO v_count FROM d;
  RETURN v_count;
END;
$$;
