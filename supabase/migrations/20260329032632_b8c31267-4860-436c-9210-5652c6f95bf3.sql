DROP POLICY IF EXISTS "Users can read promo by token" ON public.promo_codes;

CREATE POLICY "Anyone can read promo by token"
  ON public.promo_codes
  FOR SELECT
  TO anon, authenticated
  USING (true);