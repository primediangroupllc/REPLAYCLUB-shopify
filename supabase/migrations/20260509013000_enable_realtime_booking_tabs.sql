-- Enable Supabase Realtime for booking_tab_images and booking_tab_layout.
-- Without this, postgres_changes subscriptions in useBookingTabImages /
-- useBookingTabLayout never fire, so admin edits don't propagate to live
-- site sessions until a hard refresh.

ALTER TABLE public.booking_tab_images REPLICA IDENTITY FULL;
ALTER TABLE public.booking_tab_layout REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'booking_tab_images'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_tab_images;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'booking_tab_layout'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_tab_layout;
  END IF;
END $$;
