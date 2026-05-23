
CREATE TABLE public.equipment_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_name text NOT NULL UNIQUE,
  is_available boolean NOT NULL DEFAULT true,
  maintenance_note text,
  unavailable_since timestamptz,
  expected_available_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.equipment_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage equipment status"
ON public.equipment_status FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can read equipment status"
ON public.equipment_status FOR SELECT
TO anon, authenticated
USING (true);
