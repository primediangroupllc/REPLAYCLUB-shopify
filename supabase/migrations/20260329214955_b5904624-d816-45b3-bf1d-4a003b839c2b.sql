
CREATE TABLE public.gift_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  amount_cents integer NOT NULL,
  balance_cents integer NOT NULL,
  purchaser_email text,
  purchaser_user_id uuid,
  recipient_email text,
  recipient_name text,
  personal_message text,
  stripe_session_id text,
  payment_status text NOT NULL DEFAULT 'pending',
  issued_by_admin boolean NOT NULL DEFAULT false,
  redeemed_at timestamptz,
  redeemed_by_booking_id uuid REFERENCES public.bookings(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;

-- Users can read their own gift cards (purchased or received)
CREATE POLICY "Users can read own gift cards"
  ON public.gift_cards FOR SELECT TO authenticated
  USING (
    lower(purchaser_email) = lower(COALESCE((auth.jwt() ->> 'email'), ''))
    OR lower(recipient_email) = lower(COALESCE((auth.jwt() ->> 'email'), ''))
  );

-- Admins can manage all gift cards
CREATE POLICY "Admins can manage gift cards"
  ON public.gift_cards FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Service role full access
CREATE POLICY "Service role manages gift cards"
  ON public.gift_cards FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Anyone can look up a gift card by code (for redemption)
CREATE POLICY "Anyone can lookup gift card by code"
  ON public.gift_cards FOR SELECT TO authenticated
  USING (true);
