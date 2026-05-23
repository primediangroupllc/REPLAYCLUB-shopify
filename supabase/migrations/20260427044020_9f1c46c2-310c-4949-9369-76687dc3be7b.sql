ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS orbit_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS orbit_nodes jsonb NOT NULL DEFAULT '[]'::jsonb;