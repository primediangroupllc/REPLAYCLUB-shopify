-- Single-use $10 (or any amount) discount codes for studio bookings
CREATE TABLE public.discount_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  amount_cents integer NOT NULL DEFAULT 1000,
  label text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  redeemed boolean NOT NULL DEFAULT false,
  redeemed_at timestamptz,
  redeemed_by_email text,
  redeemed_by_booking_id uuid
);

CREATE INDEX idx_discount_codes_code ON public.discount_codes (code) WHERE redeemed = false;
CREATE INDEX idx_discount_codes_token ON public.discount_codes (token) WHERE redeemed = false;

ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage discount codes"
  ON public.discount_codes
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages discount codes"
  ON public.discount_codes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);