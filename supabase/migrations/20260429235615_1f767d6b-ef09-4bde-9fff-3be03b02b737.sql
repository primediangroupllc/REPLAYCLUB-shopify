-- ============================================================
-- Admin CMS Foundation — Chunk 1
-- ============================================================

-- 1. studio_configurations: add CMS-controllable columns
ALTER TABLE public.studio_configurations
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS base_price_cents integer,
  ADD COLUMN IF NOT EXISTS starting_at_copy text,
  ADD COLUMN IF NOT EXISTS hero_image_url text,
  ADD COLUMN IF NOT EXISTS gallery_image_urls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS card_image_url text;

CREATE INDEX IF NOT EXISTS idx_studio_configurations_active_sort
  ON public.studio_configurations (is_active, sort_order);

-- 2. custom_equipment_items: add hourly/weekly + quantity
ALTER TABLE public.custom_equipment_items
  ADD COLUMN IF NOT EXISTS hourly_price_cents integer,
  ADD COLUMN IF NOT EXISTS weekly_price_cents integer,
  ADD COLUMN IF NOT EXISTS quantity_available integer NOT NULL DEFAULT 1;

-- Seed equipment catalog from current rentalPriceMap (daily prices in cents).
-- ON CONFLICT DO NOTHING so re-running is safe.
-- price_cents = daily, hourly/weekly left NULL for admin to fill.
INSERT INTO public.custom_equipment_items (name, category, price_cents, price_label, sort_order, bookable)
VALUES
  ('AlphaTheta XDJ-AZ', 'DJ', 12500, '$125/day', 10, true),
  ('Ableton Push', 'Production', 2500, '$25/day', 20, true),
  ('Novation Launch Control', 'Production', 1500, '$15/day', 30, true),
  ('JBL 305P MKii 5"', 'Monitoring', 2000, '$20/day', 40, true),
  ('Sony FX3', 'Camera', 11500, '$115/day', 50, true),
  ('Canon 90D', 'Camera', 6500, '$65/day', 60, true),
  ('DJI Wireless Mic', 'Audio', 1500, '$15/day', 70, true),
  ('Sony 4K FDR-X3000', 'Camera', 5000, '$50/day', 80, true),
  ('SC Electronics V7 Mic', 'Audio', 2500, '$25/day', 90, true),
  ('Sony C800', 'Audio', 13500, '$135/day', 100, true),
  ('TLM 103', 'Audio', 4000, '$40/day', 110, true),
  ('SHURE SM7B', 'Audio', 2000, '$20/day', 120, true),
  ('BACH 195 w/ Vintage U87 Capsule', 'Audio', 7000, '$70/day', 130, true),
  ('BLUE Condenser Mic', 'Audio', 1500, '$15/day', 140, true),
  ('Prophet 8', 'Production', 17500, '$175/day', 150, true),
  ('Cube Amp', 'Audio', 1000, '$10/day', 160, true),
  ('Phone Ring Light x2', 'Lighting', 1000, '$10/day', 170, true),
  ('GVM PRO-SD300B', 'Lighting', 3500, '$35/day', 180, true),
  ('LED Light Bar x2', 'Lighting', 2000, '$20/day', 190, true),
  ('ART & Lutherie Acoustic', 'Instrument', 2000, '$20/day', 200, true),
  ('Lava Acoustic', 'Instrument', 1500, '$15/day', 210, true),
  ('DT 990 Pro Headphones', 'Monitoring', 1000, '$10/day', 220, true),
  ('DT 770 Headphones', 'Monitoring', 1000, '$10/day', 230, true),
  ('Ronin RS3 Mini', 'Camera', 4500, '$45/day', 240, true),
  ('Rode Shotgun Mic', 'Audio', 2000, '$20/day', 250, true),
  ('Sony FX3 XLR Mic Attachment', 'Camera', 1500, '$15/day', 260, true),
  ('Prism FX Lenses x4', 'Camera', 3000, '$30/day', 270, true),
  ('Canon 70-200mm Lens', 'Camera', 4500, '$45/day', 280, true),
  ('Custom Lighting Setup', 'Lighting', 0, 'Included', 290, true),
  ('Custom Background', 'Backdrop', 0, 'Included', 300, true)
ON CONFLICT DO NOTHING;

-- 3. site_settings: add admin-editable copy + business info columns
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS hero_headline text,
  ADD COLUMN IF NOT EXISTS hero_subhead text,
  ADD COLUMN IF NOT EXISTS footer_text text,
  ADD COLUMN IF NOT EXISTS business_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS business_address text,
  ADD COLUMN IF NOT EXISTS contact_phone_display text,
  ADD COLUMN IF NOT EXISTS conduct_policy_text text,
  ADD COLUMN IF NOT EXISTS cancellation_policy_text text,
  ADD COLUMN IF NOT EXISTS rental_policy_text text,
  ADD COLUMN IF NOT EXISTS id_retention_disclosure_text text;

-- 4. Storage bucket for service images (public read, admin write)
INSERT INTO storage.buckets (id, name, public)
VALUES ('service-images', 'service-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies for service-images
DROP POLICY IF EXISTS "Service images public read" ON storage.objects;
CREATE POLICY "Service images public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'service-images');

DROP POLICY IF EXISTS "Admins upload service images" ON storage.objects;
CREATE POLICY "Admins upload service images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'service-images'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Admins update service images" ON storage.objects;
CREATE POLICY "Admins update service images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'service-images'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    bucket_id = 'service-images'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Admins delete service images" ON storage.objects;
CREATE POLICY "Admins delete service images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'service-images'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );
