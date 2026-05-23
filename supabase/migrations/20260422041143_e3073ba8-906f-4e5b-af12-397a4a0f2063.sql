-- ============ REFUND REQUESTS ============
CREATE TABLE public.refund_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID,
  rental_id UUID,
  rsvp_id UUID,
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  reason TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, auto_approved, approved, denied, processed, failed
  stripe_refund_id TEXT,
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  hours_before_session NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refund_requests_status ON public.refund_requests(status);
CREATE INDEX idx_refund_requests_email ON public.refund_requests(lower(customer_email));
CREATE INDEX idx_refund_requests_booking ON public.refund_requests(booking_id) WHERE booking_id IS NOT NULL;

ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage refund requests" ON public.refund_requests
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages refund requests" ON public.refund_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users read own refund requests" ON public.refund_requests
  FOR SELECT TO authenticated
  USING (lower(customer_email) = lower(COALESCE(auth.jwt() ->> 'email', '')));

CREATE POLICY "Users create own refund requests" ON public.refund_requests
  FOR INSERT TO authenticated
  WITH CHECK (lower(customer_email) = lower(COALESCE(auth.jwt() ->> 'email', '')));

CREATE TRIGGER update_refund_requests_updated_at
  BEFORE UPDATE ON public.refund_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ BOOKINGS: refund + UTM columns ============
ALTER TABLE public.bookings
  ADD COLUMN cancellation_reason TEXT,
  ADD COLUMN refund_status TEXT,
  ADD COLUMN refunded_amount_cents INTEGER DEFAULT 0,
  ADD COLUMN utm_source TEXT,
  ADD COLUMN utm_medium TEXT,
  ADD COLUMN utm_campaign TEXT,
  ADD COLUMN utm_term TEXT,
  ADD COLUMN utm_content TEXT,
  ADD COLUMN referrer_url TEXT;

-- ============ EVENT RSVPS: UTM columns ============
ALTER TABLE public.event_rsvps
  ADD COLUMN utm_source TEXT,
  ADD COLUMN utm_medium TEXT,
  ADD COLUMN utm_campaign TEXT,
  ADD COLUMN utm_term TEXT,
  ADD COLUMN utm_content TEXT,
  ADD COLUMN referrer_url TEXT;

-- ============ STRIPE DISPUTES ============
CREATE TABLE public.stripe_disputes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_dispute_id TEXT NOT NULL UNIQUE,
  stripe_charge_id TEXT,
  stripe_payment_intent_id TEXT,
  booking_id UUID,
  rental_id UUID,
  rsvp_id UUID,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  reason TEXT,
  status TEXT NOT NULL,
  evidence_due_by TIMESTAMPTZ,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stripe_disputes_status ON public.stripe_disputes(status);
CREATE INDEX idx_stripe_disputes_booking ON public.stripe_disputes(booking_id) WHERE booking_id IS NOT NULL;

ALTER TABLE public.stripe_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read disputes" ON public.stripe_disputes
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages disputes" ON public.stripe_disputes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER update_stripe_disputes_updated_at
  BEFORE UPDATE ON public.stripe_disputes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ACCOUNT DELETION REQUESTS ============
CREATE TABLE public.account_deletion_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, cancelled, processed
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  processed_at TIMESTAMPTZ,
  cancellation_token TEXT NOT NULL DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_account_deletion_user ON public.account_deletion_requests(user_id);
CREATE INDEX idx_account_deletion_status ON public.account_deletion_requests(status);

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own deletion requests" ON public.account_deletion_requests
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins read deletion requests" ON public.account_deletion_requests
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages deletion requests" ON public.account_deletion_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============ ADMIN 2FA ============
CREATE TABLE public.admin_2fa (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  secret TEXT NOT NULL,
  recovery_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT false,
  enrolled_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_2fa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own 2fa" ON public.admin_2fa
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role manages 2fa" ON public.admin_2fa
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER update_admin_2fa_updated_at
  BEFORE UPDATE ON public.admin_2fa
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ EXPERIMENTS (A/B testing) ============
CREATE TABLE public.experiments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  variants JSONB NOT NULL DEFAULT '["control","variant"]'::jsonb,
  weights JSONB,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, running, paused, completed
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.experiments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads running experiments" ON public.experiments
  FOR SELECT TO anon, authenticated
  USING (status = 'running');

CREATE POLICY "Admins manage experiments" ON public.experiments
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages experiments" ON public.experiments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER update_experiments_updated_at
  BEFORE UPDATE ON public.experiments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.experiment_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  experiment_id UUID NOT NULL REFERENCES public.experiments(id) ON DELETE CASCADE,
  experiment_key TEXT NOT NULL,
  subject_id TEXT NOT NULL, -- user.id or anonymous session id
  variant TEXT NOT NULL,
  converted_at TIMESTAMPTZ,
  conversion_value_cents INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (experiment_id, subject_id)
);

CREATE INDEX idx_experiment_assignments_subject ON public.experiment_assignments(subject_id);

ALTER TABLE public.experiment_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone inserts assignment" ON public.experiment_assignments
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Subjects read own assignments" ON public.experiment_assignments
  FOR SELECT TO authenticated
  USING (subject_id = auth.uid()::text);

CREATE POLICY "Admins read all assignments" ON public.experiment_assignments
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages assignments" ON public.experiment_assignments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============ QUERY PERFORMANCE LOG ============
CREATE TABLE public.query_performance_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  query_fingerprint TEXT NOT NULL,
  query_sample TEXT,
  mean_exec_ms NUMERIC NOT NULL,
  max_exec_ms NUMERIC,
  calls INTEGER NOT NULL DEFAULT 1,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_query_perf_captured ON public.query_performance_log(captured_at DESC);

ALTER TABLE public.query_performance_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read query performance" ON public.query_performance_log
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages query performance" ON public.query_performance_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============ EDGE FUNCTION METRICS (daily rollup) ============
CREATE TABLE public.edge_function_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name TEXT NOT NULL,
  metric_date DATE NOT NULL DEFAULT (now())::date,
  total_calls INTEGER NOT NULL DEFAULT 0,
  error_4xx INTEGER NOT NULL DEFAULT 0,
  error_5xx INTEGER NOT NULL DEFAULT 0,
  p95_ms NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (function_name, metric_date)
);

ALTER TABLE public.edge_function_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read function metrics" ON public.edge_function_metrics
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages function metrics" ON public.edge_function_metrics
  FOR ALL TO service_role USING (true) WITH CHECK (true);