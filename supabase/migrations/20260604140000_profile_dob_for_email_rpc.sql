-- DOB cross-check helper for stripe-webhook (Phase 2 piece #2). At identity
-- verification, the webhook compares the DOB printed on the government ID against
-- the DOB the account self-reported at signup. The webhook is keyed by
-- booking.customer_email, but profiles has no email column, so this bridges
-- email -> the account's stored date_of_birth.
--
-- SECURITY DEFINER (reads auth.users + profiles). Locked to service_role (the
-- webhook) — not callable by anon/authenticated.
CREATE OR REPLACE FUNCTION public.profile_dob_for_email(p_email text)
RETURNS date
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT p.date_of_birth
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE lower(u.email) = lower(p_email)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.profile_dob_for_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_dob_for_email(text) TO service_role;
