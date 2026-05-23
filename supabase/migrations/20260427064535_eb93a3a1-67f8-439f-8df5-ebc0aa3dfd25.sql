-- ============================================================
-- 1. loyalty_coupons table
-- ============================================================
CREATE TABLE public.loyalty_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  threshold integer NOT NULL CHECK (threshold IN (5, 15, 30, 50)),
  percent integer NOT NULL CHECK (percent BETWEEN 1 AND 100),
  code text NOT NULL UNIQUE,
  issued_at timestamptz NOT NULL DEFAULT now(),
  issued_by_admin uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  redeemed_at timestamptz,
  redeemed_booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  revoked_by_admin uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoke_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One coupon per (email, threshold), but allow re-issue if previous was revoked.
CREATE UNIQUE INDEX loyalty_coupons_email_threshold_active_idx
  ON public.loyalty_coupons (lower(user_email), threshold)
  WHERE revoked_at IS NULL;

CREATE INDEX loyalty_coupons_email_idx ON public.loyalty_coupons (lower(user_email));
CREATE INDEX loyalty_coupons_unredeemed_idx
  ON public.loyalty_coupons (lower(user_email))
  WHERE redeemed_at IS NULL AND revoked_at IS NULL;

ALTER TABLE public.loyalty_coupons ENABLE ROW LEVEL SECURITY;

-- Users can see their own coupons (matched by email of authed user).
CREATE POLICY "Users view own coupons"
  ON public.loyalty_coupons FOR SELECT
  TO authenticated
  USING (
    lower(user_email) = lower(COALESCE(
      (SELECT email FROM auth.users WHERE id = auth.uid()),
      ''
    ))
  );

-- Admins can do everything.
CREATE POLICY "Admins manage all coupons"
  ON public.loyalty_coupons FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 2. Threshold → percent map (single source of truth)
-- ============================================================
CREATE OR REPLACE FUNCTION public.loyalty_threshold_percent(p_threshold integer)
RETURNS integer
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_threshold
    WHEN 5 THEN 10
    WHEN 15 THEN 20
    WHEN 30 THEN 35
    WHEN 50 THEN 45
    ELSE NULL
  END;
$$;

-- ============================================================
-- 3. Idempotent issuance for a single user
-- ============================================================
CREATE OR REPLACE FUNCTION public.issue_threshold_coupons_for_email(p_email text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_user_id uuid;
  v_paid integer;
  v_threshold integer;
  v_thresholds integer[] := ARRAY[5, 15, 30, 50];
BEGIN
  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RETURN 0;
  END IF;

  -- Resolve user_id (may be NULL for guest bookings).
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;

  -- Count cumulative paid/promo sessions.
  SELECT COUNT(*)::int INTO v_paid
  FROM public.bookings
  WHERE lower(customer_email) = lower(p_email)
    AND payment_status IN ('paid', 'promo');

  FOREACH v_threshold IN ARRAY v_thresholds LOOP
    IF v_paid >= v_threshold THEN
      INSERT INTO public.loyalty_coupons (
        user_email, user_id, threshold, percent, code
      )
      VALUES (
        lower(p_email),
        v_user_id,
        v_threshold,
        public.loyalty_threshold_percent(v_threshold),
        'RC' || v_threshold || '-' || upper(substr(md5(random()::text || clock_timestamp()::text || p_email), 1, 8))
      )
      ON CONFLICT DO NOTHING;
      IF FOUND THEN
        v_count := v_count + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ============================================================
-- 4. Trigger on bookings → auto-issue when a booking becomes paid
-- ============================================================
CREATE OR REPLACE FUNCTION public.bookings_issue_loyalty_coupons()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_status IN ('paid', 'promo')
     AND (TG_OP = 'INSERT' OR OLD.payment_status IS DISTINCT FROM NEW.payment_status)
     AND NEW.customer_email IS NOT NULL THEN
    PERFORM public.issue_threshold_coupons_for_email(NEW.customer_email);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bookings_issue_loyalty_coupons ON public.bookings;
CREATE TRIGGER trg_bookings_issue_loyalty_coupons
  AFTER INSERT OR UPDATE OF payment_status ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.bookings_issue_loyalty_coupons();

-- ============================================================
-- 5. Atomic redemption (server-side only)
-- ============================================================
CREATE OR REPLACE FUNCTION public.redeem_loyalty_coupon(
  p_coupon_id uuid,
  p_email text,
  p_booking_id uuid
)
RETURNS TABLE(success boolean, percent integer, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.loyalty_coupons%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.loyalty_coupons WHERE id = p_coupon_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 'not_found'::text; RETURN;
  END IF;
  IF lower(v_row.user_email) <> lower(p_email) THEN
    RETURN QUERY SELECT false, 0, 'wrong_owner'::text; RETURN;
  END IF;
  IF v_row.redeemed_at IS NOT NULL THEN
    RETURN QUERY SELECT false, 0, 'already_redeemed'::text; RETURN;
  END IF;
  IF v_row.revoked_at IS NOT NULL THEN
    RETURN QUERY SELECT false, 0, 'revoked'::text; RETURN;
  END IF;

  UPDATE public.loyalty_coupons
    SET redeemed_at = now(),
        redeemed_booking_id = p_booking_id
    WHERE id = p_coupon_id;

  RETURN QUERY SELECT true, v_row.percent, NULL::text;
END;
$$;

-- ============================================================
-- 6. Admin: list unredeemed coupons with paid-session counts
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_list_loyalty_coupons()
RETURNS TABLE(
  id uuid,
  user_email text,
  threshold integer,
  percent integer,
  code text,
  issued_at timestamptz,
  redeemed_at timestamptz,
  redeemed_booking_id uuid,
  revoked_at timestamptz,
  revoke_reason text,
  paid_session_count integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id, c.user_email, c.threshold, c.percent, c.code,
    c.issued_at, c.redeemed_at, c.redeemed_booking_id,
    c.revoked_at, c.revoke_reason,
    (SELECT COUNT(*)::int FROM public.bookings b
     WHERE lower(b.customer_email) = lower(c.user_email)
       AND b.payment_status IN ('paid', 'promo'))
  FROM public.loyalty_coupons c
  ORDER BY c.issued_at DESC;
$$;

-- ============================================================
-- 7. Retroactive backfill — issue coupons for every existing user
-- ============================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT lower(customer_email) AS email
    FROM public.bookings
    WHERE customer_email IS NOT NULL
      AND payment_status IN ('paid', 'promo')
  LOOP
    PERFORM public.issue_threshold_coupons_for_email(r.email);
  END LOOP;
END $$;