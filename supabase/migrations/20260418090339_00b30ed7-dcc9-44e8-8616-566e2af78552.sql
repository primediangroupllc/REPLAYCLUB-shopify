DROP FUNCTION IF EXISTS public.get_host_event(text);

CREATE OR REPLACE FUNCTION public.get_host_event(p_token text)
RETURNS TABLE(
  host_id uuid, host_name text, organization text, event_id uuid,
  title text, description text, event_date date, start_time text, end_time text,
  room_title text, location text, capacity int, price_cents int, is_free boolean,
  cover_image_url text, status text, event_type text, refund_policy text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT h.id, h.host_name, h.organization, e.id,
         e.title, e.description, e.event_date, e.start_time, e.end_time,
         e.room_title, e.location, e.capacity, e.price_cents, e.is_free,
         e.cover_image_url, e.status, e.event_type, e.refund_policy
  FROM public.event_hosts h
  JOIN public.events e ON e.id = h.event_id
  WHERE h.token = p_token AND h.revoked = false
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_host_event(text) TO anon, authenticated;