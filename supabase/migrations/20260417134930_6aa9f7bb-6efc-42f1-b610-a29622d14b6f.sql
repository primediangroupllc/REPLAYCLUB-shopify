-- =====================================================
-- EVENTS TABLE
-- =====================================================
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  room_title TEXT,
  capacity INTEGER NOT NULL DEFAULT 30,
  price_cents INTEGER NOT NULL DEFAULT 0,
  cover_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  is_public_teaser BOOLEAN NOT NULL DEFAULT true,
  event_type TEXT NOT NULL DEFAULT 'listening_session',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT events_status_check CHECK (status IN ('draft','published','cancelled','completed')),
  CONSTRAINT events_capacity_check CHECK (capacity > 0),
  CONSTRAINT events_price_check CHECK (price_cents >= 0)
);

CREATE INDEX idx_events_date_status ON public.events(event_date, status);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read public teaser events"
ON public.events FOR SELECT
TO anon, authenticated
USING (status = 'published' AND is_public_teaser = true);

CREATE POLICY "Authenticated users can read all published events"
ON public.events FOR SELECT
TO authenticated
USING (status IN ('published','cancelled','completed'));

CREATE POLICY "Admins can manage events"
ON public.events FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages events"
ON public.events FOR ALL
TO service_role
USING (true) WITH CHECK (true);

-- =====================================================
-- EVENT RSVPS TABLE
-- =====================================================
CREATE TABLE public.event_rsvps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID,
  user_email TEXT NOT NULL,
  user_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  payment_status TEXT NOT NULL DEFAULT 'free',
  stripe_session_id TEXT,
  amount_paid_cents INTEGER NOT NULL DEFAULT 0,
  ticket_code TEXT,
  checked_in_at TIMESTAMP WITH TIME ZONE,
  checked_in_by UUID,
  waitlist_position INTEGER,
  promoted_from_waitlist_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT event_rsvps_status_check CHECK (status IN ('confirmed','waitlist','cancelled','pending_payment')),
  CONSTRAINT event_rsvps_payment_check CHECK (payment_status IN ('free','pending','paid','refunded','failed')),
  CONSTRAINT event_rsvps_unique_email_event UNIQUE (event_id, user_email)
);

CREATE INDEX idx_event_rsvps_event_status ON public.event_rsvps(event_id, status);
CREATE INDEX idx_event_rsvps_user_email ON public.event_rsvps(lower(user_email));
CREATE UNIQUE INDEX idx_event_rsvps_ticket_code ON public.event_rsvps(ticket_code) WHERE ticket_code IS NOT NULL;

ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own rsvps"
ON public.event_rsvps FOR SELECT
TO authenticated
USING (lower(user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)));

CREATE POLICY "Users can create own rsvps"
ON public.event_rsvps FOR INSERT
TO authenticated
WITH CHECK (lower(user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)));

CREATE POLICY "Users can cancel own rsvps"
ON public.event_rsvps FOR UPDATE
TO authenticated
USING (lower(user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)))
WITH CHECK (lower(user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)));

CREATE POLICY "Admins can read all rsvps"
ON public.event_rsvps FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage rsvps"
ON public.event_rsvps FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages rsvps"
ON public.event_rsvps FOR ALL
TO service_role
USING (true) WITH CHECK (true);

-- =====================================================
-- EVENT WAITLIST NOTIFICATIONS
-- =====================================================
CREATE TABLE public.event_waitlist_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rsvp_id UUID NOT NULL REFERENCES public.event_rsvps(id) ON DELETE CASCADE,
  notified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours'),
  claimed BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.event_waitlist_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages waitlist notifications"
ON public.event_waitlist_notifications FOR ALL
TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Admins can read waitlist notifications"
ON public.event_waitlist_notifications FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- HELPERS
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_event_attendance(p_event_id UUID)
RETURNS JSON
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'confirmed_count', COALESCE((
      SELECT COUNT(*)::int FROM event_rsvps
      WHERE event_id = p_event_id AND status = 'confirmed'
    ), 0),
    'waitlist_count', COALESCE((
      SELECT COUNT(*)::int FROM event_rsvps
      WHERE event_id = p_event_id AND status = 'waitlist'
    ), 0),
    'capacity', COALESCE((SELECT capacity FROM events WHERE id = p_event_id), 0)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_event_attendance(UUID) TO anon, authenticated;

-- updated_at trigger function (reuse if exists)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_events_updated_at
BEFORE UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_event_rsvps_updated_at
BEFORE UPDATE ON public.event_rsvps
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();