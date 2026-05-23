ALTER TABLE public.site_settings
  -- Business info
  ADD COLUMN IF NOT EXISTS business_legal_name text,
  ADD COLUMN IF NOT EXISTS business_dba text,
  ADD COLUMN IF NOT EXISTS business_tax_id text,
  ADD COLUMN IF NOT EXISTS business_timezone text DEFAULT 'America/Los_Angeles',
  ADD COLUMN IF NOT EXISTS business_locale text DEFAULT 'en-US',

  -- Branding
  ADD COLUMN IF NOT EXISTS logo_light_url text,
  ADD COLUMN IF NOT EXISTS logo_dark_url text,
  ADD COLUMN IF NOT EXISTS favicon_url text,

  -- Communications
  -- email_senders shape: { "<type>": { "from_name": "...", "reply_to": "..." } }
  -- types: booking_confirmation, admin_notification, reminder, followup, default
  ADD COLUMN IF NOT EXISTS email_senders jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sms_sender_number text,
  ADD COLUMN IF NOT EXISTS admin_notification_recipients text[] NOT NULL DEFAULT ARRAY[]::text[],

  -- Integrations
  ADD COLUMN IF NOT EXISTS twitch_channel text DEFAULT 'REPLAYCLUB_',
  ADD COLUMN IF NOT EXISTS youtube_channel_handle text DEFAULT '@ReplayClubRecords',
  ADD COLUMN IF NOT EXISTS soundcloud_embed_url text,

  -- Operations & safety
  ADD COLUMN IF NOT EXISTS maintenance_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS maintenance_message text,
  -- booking_pauses shape: { "music": true, "dj": false, ... }
  ADD COLUMN IF NOT EXISTS booking_pauses jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text;