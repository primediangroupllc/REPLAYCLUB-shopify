-- 1. Add admin-editable hero hue + display order for events
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS studio_hero_hue TEXT;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_events_sort_order ON public.events(sort_order);

-- 2. Public storage bucket for studio card images (layouts/tiers/addons)
INSERT INTO storage.buckets (id, name, public)
VALUES ('studio-assets', 'studio-assets', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Public read studio-assets') THEN
    CREATE POLICY "Public read studio-assets" ON storage.objects FOR SELECT
      USING (bucket_id = 'studio-assets');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Admins write studio-assets') THEN
    CREATE POLICY "Admins write studio-assets" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'studio-assets' AND public.has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Admins update studio-assets') THEN
    CREATE POLICY "Admins update studio-assets" ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'studio-assets' AND public.has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Admins delete studio-assets') THEN
    CREATE POLICY "Admins delete studio-assets" ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'studio-assets' AND public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;