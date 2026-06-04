-- Date of birth at signup: a self-reported 18+ PRE-gate collected on the signup
-- form. Stripe Identity (which reads the real government ID at booking) remains
-- the AUTHORITATIVE age check — this is just a cheap filter so an under-18
-- self-reporter never reaches the paid ID step.
--
-- PII: stored on profiles, whose RLS already restricts reads to the user
-- themselves ("Users can read own profile") + admins ("Admins can read all
-- profiles"). NOT in auth user_metadata, which the user can edit freely.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS date_of_birth date;

-- Persist DOB from signup metadata into the profile, and enforce 18+ server-side
-- as defense-in-depth. The FRIENDLY under-18 message comes from the client check
-- (which runs first); this RAISE only catches a direct-API bypass, where a
-- generic auth error is acceptable. DOB-less signups (admin-created, future
-- OAuth) are allowed through with a NULL dob — the RAISE only fires when a DOB
-- is actually supplied AND is under 18.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dob date;
BEGIN
  v_dob := NULLIF(NEW.raw_user_meta_data ->> 'date_of_birth', '')::date;

  IF v_dob IS NOT NULL AND v_dob > (CURRENT_DATE - INTERVAL '18 years') THEN
    RAISE EXCEPTION 'account holders must be 18 or older' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.profiles (id, date_of_birth)
  VALUES (NEW.id, v_dob);

  RETURN NEW;
END;
$$;

-- Soft write-once on DOB: a user may correct their date of birth freely UNTIL
-- their identity has been verified, after which it's locked. "Verified" = any
-- booking on the user's email reached verification_status='approved'. Soft =
-- service_role can still override (admin correction path).
CREATE OR REPLACE FUNCTION public.lock_dob_after_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  IF NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth
     AND auth.role() <> 'service_role' THEN
    SELECT lower(email) INTO v_email FROM auth.users WHERE id = NEW.id;
    IF v_email IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.bookings
      WHERE lower(customer_email) = v_email
        AND verification_status = 'approved'
    ) THEN
      RAISE EXCEPTION 'date of birth is locked after identity verification'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lock_dob_after_verification ON public.profiles;
CREATE TRIGGER lock_dob_after_verification
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.lock_dob_after_verification();
