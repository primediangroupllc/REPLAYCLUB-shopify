
CREATE OR REPLACE FUNCTION public.get_unavailable_equipment()
RETURNS TABLE(equipment_name text, available_after date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT
    e.item::text AS equipment_name,
    MAX(b.booking_date)::date AS available_after
  FROM bookings b,
    jsonb_array_elements_text(b.equipment) AS e(item)
  WHERE b.payment_status = 'paid'
    AND b.booking_date >= CURRENT_DATE
  GROUP BY e.item;
$$;
