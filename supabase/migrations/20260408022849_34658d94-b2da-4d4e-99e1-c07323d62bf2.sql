
CREATE TABLE public.booking_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  followup_sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id)
);

ALTER TABLE public.booking_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages followups"
ON public.booking_followups FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
