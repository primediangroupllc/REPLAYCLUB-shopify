-- Custom equipment items added via admin UI.
-- Hardcoded catalog in EquipmentSection.tsx remains the base list;
-- this table adds admin-managed items on top, with a per-item bookable flag.
CREATE TABLE public.custom_equipment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  category text NOT NULL DEFAULT 'Other',
  image_url text,
  price_cents integer NOT NULL DEFAULT 0,
  price_label text,
  sort_order integer NOT NULL DEFAULT 0,
  bookable boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_equipment_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads custom equipment"
  ON public.custom_equipment_items FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins manage custom equipment"
  ON public.custom_equipment_items FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages custom equipment"
  ON public.custom_equipment_items FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_custom_equipment_items_updated
  BEFORE UPDATE ON public.custom_equipment_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();