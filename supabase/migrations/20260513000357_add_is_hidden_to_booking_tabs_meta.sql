-- Add is_hidden flag to booking_tabs_meta so admin can hide a card from
-- the home selector without deleting any data. Defaults to false; existing
-- rows remain visible.
ALTER TABLE public.booking_tabs_meta
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;
