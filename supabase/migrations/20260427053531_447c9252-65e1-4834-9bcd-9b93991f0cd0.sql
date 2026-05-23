ALTER TABLE public.site_settings
ADD COLUMN IF NOT EXISTS vision_mode_enabled boolean NOT NULL DEFAULT false;