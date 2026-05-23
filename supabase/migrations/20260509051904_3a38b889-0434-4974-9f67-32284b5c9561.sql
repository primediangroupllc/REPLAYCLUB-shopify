-- 2. Create booking_tabs_meta
CREATE TABLE IF NOT EXISTS public.booking_tabs_meta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_type public.booking_tab_type NOT NULL UNIQUE,
  title text NOT NULL,
  subtitle text NOT NULL DEFAULT '',
  price text NOT NULL DEFAULT '',
  description text,
  coming_soon boolean NOT NULL DEFAULT false,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booking_tabs_meta_order_idx
  ON public.booking_tabs_meta (display_order);

DROP TRIGGER IF EXISTS update_booking_tabs_meta_updated_at ON public.booking_tabs_meta;
CREATE TRIGGER update_booking_tabs_meta_updated_at
  BEFORE UPDATE ON public.booking_tabs_meta
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.booking_tabs_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view booking tabs meta" ON public.booking_tabs_meta;
CREATE POLICY "Public can view booking tabs meta"
  ON public.booking_tabs_meta FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can insert booking tabs meta" ON public.booking_tabs_meta;
CREATE POLICY "Admins can insert booking tabs meta"
  ON public.booking_tabs_meta FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update booking tabs meta" ON public.booking_tabs_meta;
CREATE POLICY "Admins can update booking tabs meta"
  ON public.booking_tabs_meta FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete booking tabs meta" ON public.booking_tabs_meta;
CREATE POLICY "Admins can delete booking tabs meta"
  ON public.booking_tabs_meta FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Seed initial rows
INSERT INTO public.booking_tabs_meta (booking_type, title, subtitle, price, coming_soon, display_order)
VALUES
  ('studio_sesh',     'Studio Sesh',     'Music Production',          'Starting at $65/hr',          true,  0),
  ('podcast',         'Podcast',         'Audio & Video Recording',   '$60/hr — 1 or 2 hour sessions', false, 1),
  ('dj_session',      'Disk Jockey',     'DJ Performance',            'Starting at $55/hr',          false, 2),
  ('backdrop',        'Photoshoot',      'Photo & Content',           'Starting at $70/hr',          true,  3),
  ('livestream',      'Livestream',      'Pro / Broadcast',           '',                            false, 4),
  ('equipment_rental','Equipment Rental','Gear To Go',                'From $10 / day',              false, 5),
  ('music',           'Music',           'Recording Studio',          'Starting at $75/hr',          false, 6)
ON CONFLICT (booking_type) DO NOTHING;

-- 4. Seed default gallery layout for the two new types
INSERT INTO public.booking_tab_layout (booking_type, layout_variant)
VALUES ('livestream', 'gallery'), ('music', 'gallery')
ON CONFLICT (booking_type) DO NOTHING;

-- 5. Enable realtime
ALTER TABLE public.booking_tabs_meta REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'booking_tabs_meta'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_tabs_meta;
  END IF;
END $$;
