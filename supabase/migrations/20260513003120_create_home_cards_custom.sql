-- Custom admin-authored cards on the home selector. Live alongside the 7
-- fixed booking_tabs_meta cards and merge with them via display_order.
CREATE TABLE IF NOT EXISTS public.home_cards_custom (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text NOT NULL DEFAULT '',
  price text NOT NULL DEFAULT '',
  image_url text,
  -- Where clicking the card sends the user. Internal route ("/podcast") or
  -- external URL ("https://..."). Empty means no navigation (use with
  -- coming_soon = true).
  route text NOT NULL DEFAULT '',
  display_order int NOT NULL DEFAULT 100,
  is_hidden boolean NOT NULL DEFAULT false,
  coming_soon boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS home_cards_custom_order_idx
  ON public.home_cards_custom (display_order);

DROP TRIGGER IF EXISTS update_home_cards_custom_updated_at ON public.home_cards_custom;
CREATE TRIGGER update_home_cards_custom_updated_at
  BEFORE UPDATE ON public.home_cards_custom
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.home_cards_custom ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view custom home cards" ON public.home_cards_custom;
CREATE POLICY "Public can view custom home cards"
  ON public.home_cards_custom FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can insert custom home cards" ON public.home_cards_custom;
CREATE POLICY "Admins can insert custom home cards"
  ON public.home_cards_custom FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update custom home cards" ON public.home_cards_custom;
CREATE POLICY "Admins can update custom home cards"
  ON public.home_cards_custom FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete custom home cards" ON public.home_cards_custom;
CREATE POLICY "Admins can delete custom home cards"
  ON public.home_cards_custom FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.home_cards_custom REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'home_cards_custom'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.home_cards_custom;
  END IF;
END $$;
