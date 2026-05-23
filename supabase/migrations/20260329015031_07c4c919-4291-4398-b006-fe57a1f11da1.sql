
CREATE TABLE public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  code text NOT NULL,
  room_title text NOT NULL,
  recipient_email text,
  redeemed boolean NOT NULL DEFAULT false,
  redeemed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  redeemed_at timestamptz
);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

-- Admins can manage all promo codes
CREATE POLICY "Admins can manage promo codes"
  ON public.promo_codes
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Service role full access
CREATE POLICY "Service role manages promo codes"
  ON public.promo_codes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can read promo codes by token (for redemption)
CREATE POLICY "Users can read promo by token"
  ON public.promo_codes
  FOR SELECT
  TO authenticated
  USING (true);
