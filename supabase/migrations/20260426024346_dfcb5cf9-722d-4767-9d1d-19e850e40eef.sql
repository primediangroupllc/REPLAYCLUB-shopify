-- Add stripe_mode to site_settings
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS stripe_mode text NOT NULL DEFAULT 'test'
    CHECK (stripe_mode IN ('test', 'live'));

-- Helper function for edge functions to read current mode
CREATE OR REPLACE FUNCTION public.get_stripe_mode()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT stripe_mode FROM public.site_settings ORDER BY id LIMIT 1),
    'test'
  );
$$;

-- Allow public read of stripe_mode via the helper
GRANT EXECUTE ON FUNCTION public.get_stripe_mode() TO anon, authenticated, service_role;

-- Ensure RLS allows admins to update site_settings (should already exist, but be safe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='site_settings' AND policyname='Admins can update site_settings'
  ) THEN
    CREATE POLICY "Admins can update site_settings"
      ON public.site_settings
      FOR UPDATE
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='site_settings' AND policyname='Anyone can read site_settings'
  ) THEN
    CREATE POLICY "Anyone can read site_settings"
      ON public.site_settings
      FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;