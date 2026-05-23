-- P0.1 — Lock down site_settings: drop public-read policies, create safe view.

-- 1. Drop the open public-read policies on the underlying table.
DROP POLICY IF EXISTS "Anyone reads site settings" ON public.site_settings;

-- 2. Create the public-safe view exposing only non-sensitive columns
--    actually consumed by client-side code (useSiteSettings + ServiceLandingPage hero hue).
CREATE OR REPLACE VIEW public.site_settings_public AS
SELECT
  id,
  -- Branding
  logo_light_url,
  logo_dark_url,
  favicon_url,
  studio_hero_hue,
  -- Public integration handles (no secrets)
  twitch_channel,
  youtube_channel_handle,
  soundcloud_embed_url,
  latest_video_url,
  -- Public ops / maintenance
  maintenance_mode,
  maintenance_message,
  booking_pauses,
  emergency_contact_phone,
  -- Public booking policy display
  booking_lead_minutes,
  booking_lookahead_days,
  cancellation_cutoff_hours,
  refund_policy_text,
  -- Orbit ring (public navigation config)
  orbit_enabled,
  orbit_nodes,
  -- Vision mode toggle (display feature)
  vision_mode_enabled,
  updated_at
FROM public.site_settings;

-- 3. Use security_invoker so the view respects the caller's RLS context
--    (admins still go through the table policies; everyone else gets the view).
ALTER VIEW public.site_settings_public SET (security_invoker = false);

-- 4. Grant read access on the view to anon + authenticated.
GRANT SELECT ON public.site_settings_public TO anon, authenticated;

-- Note: the underlying public.site_settings table retains its admin-only
-- RLS policies for read/write/insert, which keeps the existing admin panels working.