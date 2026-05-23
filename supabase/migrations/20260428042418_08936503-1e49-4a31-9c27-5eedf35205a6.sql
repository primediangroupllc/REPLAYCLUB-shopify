-- Switch view to security_invoker so it respects caller RLS / grants.
ALTER VIEW public.site_settings_public SET (security_invoker = true);

-- Grant column-level SELECT on safe columns of the underlying table.
-- (Sensitive columns are intentionally omitted: meta_capi_token, stripe_mode,
--  sms_sender_number, admin_notification_recipients, email_senders,
--  business_tax_id, business_legal_name, business_dba, email_toggles,
--  meta_pixel_id (read via SECURITY DEFINER RPC), booking_buffer_minutes,
--  daily_session_cap, shared_room_pool, slot_lock_ttl_minutes,
--  equipment_lock_ttl_minutes, business_timezone, business_locale.)
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

-- Add a row-level read policy that only returns rows; combined with the
-- column grants above, callers can only see the safe columns.
DROP POLICY IF EXISTS "Public read safe site settings columns" ON public.site_settings;
CREATE POLICY "Public read safe site settings columns"
ON public.site_settings
FOR SELECT
TO anon, authenticated
USING (true);