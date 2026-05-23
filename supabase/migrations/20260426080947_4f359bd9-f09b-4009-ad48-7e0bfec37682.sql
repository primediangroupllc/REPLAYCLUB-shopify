ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS consent_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_accepted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS consent_version text;