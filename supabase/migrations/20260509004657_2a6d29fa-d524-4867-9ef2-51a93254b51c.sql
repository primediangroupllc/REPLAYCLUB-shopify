
DO $$ BEGIN
  CREATE TYPE public.booking_tab_layout_variant AS ENUM ('single', 'gallery', 'collage');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.booking_tab_layout (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_type public.booking_tab_type NOT NULL UNIQUE,
  layout_variant public.booking_tab_layout_variant NOT NULL DEFAULT 'gallery',
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS update_booking_tab_layout_updated_at ON public.booking_tab_layout;
CREATE TRIGGER update_booking_tab_layout_updated_at
  BEFORE UPDATE ON public.booking_tab_layout
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.booking_tab_layout ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view booking tab layout" ON public.booking_tab_layout;
CREATE POLICY "Public can view booking tab layout"
  ON public.booking_tab_layout FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can insert booking tab layout" ON public.booking_tab_layout;
CREATE POLICY "Admins can insert booking tab layout"
  ON public.booking_tab_layout FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update booking tab layout" ON public.booking_tab_layout;
CREATE POLICY "Admins can update booking tab layout"
  ON public.booking_tab_layout FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete booking tab layout" ON public.booking_tab_layout;
CREATE POLICY "Admins can delete booking tab layout"
  ON public.booking_tab_layout FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Seed one row per booking type
INSERT INTO public.booking_tab_layout (booking_type, layout_variant)
VALUES
  ('dj_session', 'gallery'),
  ('podcast', 'gallery'),
  ('studio_sesh', 'gallery'),
  ('backdrop', 'gallery')
ON CONFLICT (booking_type) DO NOTHING;
