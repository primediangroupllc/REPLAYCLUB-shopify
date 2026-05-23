ALTER TABLE public.event_rsvps
  ADD COLUMN IF NOT EXISTS referring_host_id uuid;

CREATE INDEX IF NOT EXISTS idx_rsvps_referring_host ON public.event_rsvps(referring_host_id);

CREATE OR REPLACE FUNCTION public.get_host_sales_stats(p_event_id uuid)
RETURNS TABLE(
  host_id uuid,
  tickets_sold integer,
  confirmed_tickets integer,
  revenue_cents integer,
  last_sale_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    h.id AS host_id,
    COUNT(r.id)::int AS tickets_sold,
    COUNT(r.id) FILTER (WHERE r.status = 'confirmed')::int AS confirmed_tickets,
    COALESCE(SUM(r.amount_paid_cents) FILTER (WHERE r.payment_status = 'paid'), 0)::int AS revenue_cents,
    MAX(r.created_at) AS last_sale_at
  FROM public.event_hosts h
  LEFT JOIN public.event_rsvps r ON r.referring_host_id = h.id AND r.event_id = p_event_id
  WHERE h.event_id = p_event_id
  GROUP BY h.id;
$function$;