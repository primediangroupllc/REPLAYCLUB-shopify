-- ops_alerts + stranded-charge tripwire (daily, read-only, alert-only).
--
-- Covers the open 23505 duplicate-slot webhook defect: when two checkouts race
-- the same slot, the 2nd webhook's UPDATE bookings SET payment_status='paid'
-- hits bookings_unique_paid_slot_idx (23505). stripe-webhook then calls
-- refundDuplicateSlotLoser(); if that refund does not complete, the customer is
-- charged but the booking stays 'pending' — a stranded charge.
--
-- The stranded-charge-tripwire edge function reconciles pending-with-session
-- bookings against the Stripe API daily and records any Stripe-paid-but-pending
-- bookings here. It NEVER refunds or mutates bookings — a human resolves each
-- alert. Deploy the edge function before/with this migration (an early cron tick
-- just 404s harmlessly until the function exists).

-- 1. Alerts table -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ops_alerts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        text NOT NULL,                    -- 'stranded_charge', ...
  severity    text NOT NULL DEFAULT 'warning',  -- info | warning | critical
  dedupe_key  text NOT NULL,                    -- e.g. 'stranded_charge:<session_id>'
  summary     text NOT NULL,
  details     jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_ops_alerts_kind_created
  ON public.ops_alerts (kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_alerts_unresolved
  ON public.ops_alerts (created_at DESC) WHERE resolved_at IS NULL;

ALTER TABLE public.ops_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read ops alerts" ON public.ops_alerts;
CREATE POLICY "Admins can read ops alerts"
  ON public.ops_alerts FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Service role manages ops alerts" ON public.ops_alerts;
CREATE POLICY "Service role manages ops alerts"
  ON public.ops_alerts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 2. Daily schedule ---------------------------------------------------------
-- Mirrors the house cron pattern (20260418115102 / 20260610120000): pg_cron +
-- pg_net, auth via the SUPABASE_SERVICE_ROLE_KEY Vault secret already in prod.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE
  v_jobid BIGINT;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'stranded-charge-tripwire';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END $$;

-- Daily at 08:23 UTC (tunable). Read-only reconcile; one invocation/day.
SELECT cron.schedule(
  'stranded-charge-tripwire',
  '23 8 * * *',
  $cmd$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1) || '/functions/v1/stranded-charge-tripwire',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $cmd$
);
