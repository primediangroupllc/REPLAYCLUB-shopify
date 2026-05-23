
-- Analytics: track when a user is blocked from booking/renting due to equipment dependency
CREATE TABLE public.equipment_block_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_name TEXT NOT NULL,
  service TEXT NOT NULL, -- "DJ Session", "Equipment Rental", etc.
  block_direction TEXT NOT NULL, -- 'service_blocked_by_rental' or 'rental_blocked_by_service'
  blocked_date DATE,
  user_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.equipment_block_events ENABLE ROW LEVEL SECURITY;

-- Anyone (anon + authenticated) can insert — these are anonymous funnel events
CREATE POLICY "Anyone can log block events"
ON public.equipment_block_events FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only admins can read
CREATE POLICY "Admins can read block events"
ON public.equipment_block_events FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role full access
CREATE POLICY "Service role manages block events"
ON public.equipment_block_events FOR ALL
TO service_role
USING (true) WITH CHECK (true);

CREATE INDEX idx_equipment_block_events_created_at ON public.equipment_block_events (created_at DESC);
CREATE INDEX idx_equipment_block_events_equipment ON public.equipment_block_events (equipment_name, created_at DESC);
