-- Revoke the default broad privileges Supabase grants to anon/authenticated.
REVOKE ALL ON public.site_settings FROM anon, authenticated;

-- Re-grant SELECT only on the explicit safe column list.
GRANT SELECT (
  id,
  logo_light_url,
  logo_dark_url,
  favicon_url,
  studio_hero_hue,
  twitch_channel,
  youtube_channel_handle,
  soundcloud_embed_url,
  latest_video_url,
  maintenance_mode,
  maintenance_message,
  booking_pauses,
  emergency_contact_phone,
  booking_lead_minutes,
  booking_lookahead_days,
  cancellation_cutoff_hours,
  refund_policy_text,
  orbit_enabled,
  orbit_nodes,
  vision_mode_enabled,
  updated_at
) ON public.site_settings TO anon, authenticated;

-- Admin writes flow through the authenticated role + RLS write policies +
-- has_role check, so they need INSERT/UPDATE/DELETE table-level too.
GRANT INSERT, UPDATE, DELETE ON public.site_settings TO authenticated;

-- service_role retains everything (used by edge functions).
GRANT ALL ON public.site_settings TO service_role;