
CREATE TABLE public.equipment_rentals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_email TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  rental_days INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  stripe_session_id TEXT,
  pickup_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.equipment_rentals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own rentals" ON public.equipment_rentals
  FOR SELECT TO authenticated
  USING (lower(customer_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)));

CREATE POLICY "Admins can manage rentals" ON public.equipment_rentals
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages rentals" ON public.equipment_rentals
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
