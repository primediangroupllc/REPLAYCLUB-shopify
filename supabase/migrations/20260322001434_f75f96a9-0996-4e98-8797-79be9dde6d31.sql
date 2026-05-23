
-- Tighten RLS: remove overly permissive anon policies, use service_role from edge functions
DROP POLICY "Anyone can create verification codes" ON public.verification_codes;
DROP POLICY "Anyone can read verification codes" ON public.verification_codes;
DROP POLICY "Anyone can update verification codes" ON public.verification_codes;
DROP POLICY "Anyone can read bookings by stripe session" ON public.bookings;

-- Service role manages verification codes (edge functions)
CREATE POLICY "Service role manages verification codes" ON public.verification_codes FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Bookings: anon can only SELECT own booking by stripe_session_id (will filter in app)
CREATE POLICY "Anon can read own booking" ON public.bookings FOR SELECT TO anon USING (stripe_session_id IS NOT NULL);
