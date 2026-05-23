DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'site_settings',
    'studio_configurations',
    'events',
    'custom_equipment_items',
    'equipment_status',
    'talent',
    'blocked_dates',
    'events_homepage_settings',
    'events_homepage_faqs',
    'events_homepage_gallery'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t)
       AND NOT EXISTS (
         SELECT 1 FROM pg_publication_tables
         WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t
       )
    THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
