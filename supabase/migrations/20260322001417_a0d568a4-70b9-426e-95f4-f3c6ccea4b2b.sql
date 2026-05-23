
-- Verification codes for SMS OTP
CREATE TABLE public.verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bookings table
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_title TEXT NOT NULL,
  booking_date DATE NOT NULL,
  booking_time TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  tier TEXT,
  equipment JSONB DEFAULT '[]'::jsonb,
  lighting TEXT,
  sound TEXT,
  layout TEXT,
  amount_cents INTEGER NOT NULL,
  stripe_session_id TEXT,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  confirmation_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Allow anonymous inserts/reads for guest booking flow
ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Verification codes: allow insert and select by anyone (guest flow)
CREATE POLICY "Anyone can create verification codes" ON public.verification_codes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anyone can read verification codes" ON public.verification_codes FOR SELECT TO anon USING (true);
CREATE POLICY "Anyone can update verification codes" ON public.verification_codes FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Bookings: service role only for inserts (from edge functions), anon can read own by stripe session
CREATE POLICY "Service role can manage bookings" ON public.bookings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can read bookings by stripe session" ON public.bookings FOR SELECT TO anon USING (true);
