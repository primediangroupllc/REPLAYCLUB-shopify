
-- Enum for the four booking types
DO $$ BEGIN
  CREATE TYPE public.booking_tab_type AS ENUM ('dj_session', 'podcast', 'studio_sesh', 'backdrop');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table
CREATE TABLE IF NOT EXISTS public.booking_tab_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_type public.booking_tab_type NOT NULL,
  storage_path text NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  width int,
  height int,
  bytes int,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booking_tab_images_type_order_idx
  ON public.booking_tab_images (booking_type, display_order);

DROP TRIGGER IF EXISTS update_booking_tab_images_updated_at ON public.booking_tab_images;
CREATE TRIGGER update_booking_tab_images_updated_at
  BEFORE UPDATE ON public.booking_tab_images
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.booking_tab_images ENABLE ROW LEVEL SECURITY;

-- Public: read active images
DROP POLICY IF EXISTS "Public can view active booking tab images" ON public.booking_tab_images;
CREATE POLICY "Public can view active booking tab images"
  ON public.booking_tab_images FOR SELECT
  USING (is_active = true);

-- Admins: read all
DROP POLICY IF EXISTS "Admins can view all booking tab images" ON public.booking_tab_images;
CREATE POLICY "Admins can view all booking tab images"
  ON public.booking_tab_images FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admins: insert/update/delete
DROP POLICY IF EXISTS "Admins can insert booking tab images" ON public.booking_tab_images;
CREATE POLICY "Admins can insert booking tab images"
  ON public.booking_tab_images FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update booking tab images" ON public.booking_tab_images;
CREATE POLICY "Admins can update booking tab images"
  ON public.booking_tab_images FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete booking tab images" ON public.booking_tab_images;
CREATE POLICY "Admins can delete booking tab images"
  ON public.booking_tab_images FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Storage bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('booking-tab-images', 'booking-tab-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage RLS
DROP POLICY IF EXISTS "Public can read booking tab image files" ON storage.objects;
CREATE POLICY "Public can read booking tab image files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'booking-tab-images');

DROP POLICY IF EXISTS "Admins can upload booking tab image files" ON storage.objects;
CREATE POLICY "Admins can upload booking tab image files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'booking-tab-images' AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update booking tab image files" ON storage.objects;
CREATE POLICY "Admins can update booking tab image files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'booking-tab-images' AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete booking tab image files" ON storage.objects;
CREATE POLICY "Admins can delete booking tab image files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'booking-tab-images' AND public.has_role(auth.uid(), 'admin'::app_role));
