-- 1. Add new event fields
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS is_free boolean NOT NULL DEFAULT false;

-- 2. Event hosts (magic-link based co-organizer access)
CREATE TABLE IF NOT EXISTS public.event_hosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  host_name text NOT NULL,
  host_email text,
  organization text,
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  last_accessed_at timestamptz,
  revoked boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_event_hosts_event_id ON public.event_hosts(event_id);
CREATE INDEX IF NOT EXISTS idx_event_hosts_token ON public.event_hosts(token);

ALTER TABLE public.event_hosts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage event hosts"
  ON public.event_hosts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages event hosts"
  ON public.event_hosts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 3. Token-scoped read RPCs (security definer, no auth required)
CREATE OR REPLACE FUNCTION public.get_host_event(p_token text)
RETURNS TABLE(
  host_id uuid, host_name text, organization text, event_id uuid,
  title text, description text, event_date date, start_time text, end_time text,
  room_title text, location text, capacity int, price_cents int, is_free boolean,
  cover_image_url text, status text, event_type text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT h.id, h.host_name, h.organization, e.id,
         e.title, e.description, e.event_date, e.start_time, e.end_time,
         e.room_title, e.location, e.capacity, e.price_cents, e.is_free,
         e.cover_image_url, e.status, e.event_type
  FROM public.event_hosts h
  JOIN public.events e ON e.id = h.event_id
  WHERE h.token = p_token AND h.revoked = false
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_host_rsvps(p_token text)
RETURNS TABLE(
  id uuid, user_name text, user_email text, status text, payment_status text,
  amount_paid_cents int, ticket_code text, checked_in_at timestamptz,
  created_at timestamptz, waitlist_position int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.user_name, r.user_email, r.status, r.payment_status,
         r.amount_paid_cents, r.ticket_code, r.checked_in_at, r.created_at, r.waitlist_position
  FROM public.event_rsvps r
  JOIN public.event_hosts h ON h.event_id = r.event_id
  WHERE h.token = p_token AND h.revoked = false
  ORDER BY r.created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.host_check_in(p_token text, p_rsvp_id uuid, p_check_in boolean)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event_id uuid;
BEGIN
  SELECT event_id INTO v_event_id FROM public.event_hosts
    WHERE token = p_token AND revoked = false LIMIT 1;
  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or revoked host token';
  END IF;

  UPDATE public.event_rsvps
    SET checked_in_at = CASE WHEN p_check_in THEN now() ELSE NULL END
    WHERE id = p_rsvp_id AND event_id = v_event_id;

  UPDATE public.event_hosts SET last_accessed_at = now()
    WHERE token = p_token;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_host_event(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_host_rsvps(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.host_check_in(text, uuid, boolean) TO anon, authenticated;