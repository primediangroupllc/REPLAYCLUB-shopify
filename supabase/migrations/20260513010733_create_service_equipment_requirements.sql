-- Service ↔ required equipment mapping. Replaces the hardcoded
-- SERVICE_EQUIPMENT_DEPENDENCIES map in src/lib/serviceEquipmentDependencies.ts
-- so admin can edit which gear each service depends on.
--
-- Keyed by booking_type (stable enum), not title (admin-renameable). The hook
-- resolves to title via booking_tabs_meta at read time.
CREATE TABLE IF NOT EXISTS public.service_equipment_requirements (
  booking_type public.booking_tab_type NOT NULL,
  equipment_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (booking_type, equipment_name)
);

CREATE INDEX IF NOT EXISTS service_equipment_requirements_equipment_idx
  ON public.service_equipment_requirements (equipment_name);

ALTER TABLE public.service_equipment_requirements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view service equipment requirements" ON public.service_equipment_requirements;
CREATE POLICY "Public can view service equipment requirements"
  ON public.service_equipment_requirements FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can insert service equipment requirements" ON public.service_equipment_requirements;
CREATE POLICY "Admins can insert service equipment requirements"
  ON public.service_equipment_requirements FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete service equipment requirements" ON public.service_equipment_requirements;
CREATE POLICY "Admins can delete service equipment requirements"
  ON public.service_equipment_requirements FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.service_equipment_requirements REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'service_equipment_requirements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.service_equipment_requirements;
  END IF;
END $$;

-- Seed: the one mapping that existed in the hardcoded TS const.
INSERT INTO public.service_equipment_requirements (booking_type, equipment_name)
VALUES ('dj_session', 'AlphaTheta XDJ-AZ')
ON CONFLICT DO NOTHING;
