ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS booking_lead_minutes integer,
  ADD COLUMN IF NOT EXISTS booking_lookahead_days integer,
  ADD COLUMN IF NOT EXISTS cancellation_cutoff_hours integer,
  ADD COLUMN IF NOT EXISTS refund_policy_text text,
  ADD COLUMN IF NOT EXISTS email_toggles jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS slot_lock_ttl_minutes integer,
  ADD COLUMN IF NOT EXISTS equipment_lock_ttl_minutes integer;