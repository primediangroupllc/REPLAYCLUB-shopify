ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS meta_pixel_id text,
  ADD COLUMN IF NOT EXISTS meta_capi_token text;

-- Public-readable helper for the Pixel ID (browser needs it; token stays server-side)
CREATE OR REPLACE FUNCTION public.get_meta_pixel_id()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT meta_pixel_id FROM public.site_settings ORDER BY id LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_meta_pixel_id() TO anon, authenticated, service_role;

-- Restrict full row read so meta_capi_token isn't exposed via existing public select policy.
-- Drop and recreate the SELECT policy to admins-only, since the public only needs pixel_id via the helper.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='site_settings' AND policyname='Anyone can read site_settings'
  ) THEN
    DROP POLICY "Anyone can read site_settings" ON public.site_settings;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='site_settings' AND policyname='Admins can read site_settings'
  ) THEN
    CREATE POLICY "Admins can read site_settings"
      ON public.site_settings FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- Public still needs stripe_mode + latest_video_url + pixel_id; expose via helpers (stripe_mode + pixel helper already exist)
CREATE OR REPLACE FUNCTION public.get_latest_video_url()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT latest_video_url FROM public.site_settings ORDER BY id LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_latest_video_url() TO anon, authenticated, service_role;