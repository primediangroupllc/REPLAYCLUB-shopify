
-- Add referral_code to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;

-- Create referrals tracking table
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referred_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  credit_amount_cents integer NOT NULL DEFAULT 1000,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  credit_used_at timestamptz,
  credit_used_booking_id uuid REFERENCES public.bookings(id)
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own referrals" ON public.referrals
  FOR SELECT TO authenticated
  USING (referrer_id = auth.uid());

CREATE POLICY "Service role manages referrals" ON public.referrals
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Function to generate referral code on profile creation
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := upper(substr(md5(NEW.id::text || now()::text), 1, 8));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_referral_code
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (NEW.referral_code IS NULL)
  EXECUTE FUNCTION public.generate_referral_code();

-- Backfill existing profiles with referral codes
UPDATE public.profiles SET referral_code = upper(substr(md5(id::text || now()::text), 1, 8)) WHERE referral_code IS NULL;

-- Function to get referral credits for a user
CREATE OR REPLACE FUNCTION public.get_referral_credits(user_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT json_build_object(
    'total_referrals', (SELECT COUNT(*)::int FROM referrals WHERE referrer_id = user_id AND status = 'completed'),
    'available_credits_cents', (SELECT COALESCE(SUM(credit_amount_cents)::int, 0) FROM referrals WHERE referrer_id = user_id AND status = 'completed' AND credit_used_at IS NULL),
    'used_credits_cents', (SELECT COALESCE(SUM(credit_amount_cents)::int, 0) FROM referrals WHERE referrer_id = user_id AND credit_used_at IS NOT NULL)
  );
$$;
