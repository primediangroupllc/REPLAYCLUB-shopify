
-- 1. Fix rental overlap detection (consider full rental window for room bookings & equipment_rentals)
CREATE OR REPLACE FUNCTION public.get_unavailable_equipment()
RETURNS TABLE(equipment_name text, available_after date)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH booking_items AS (
    -- Room bookings with equipment add-ons (single day)
    SELECT
      e.item::text AS equipment_name,
      b.booking_date AS end_date
    FROM bookings b,
      jsonb_array_elements_text(b.equipment) AS e(item)
    WHERE b.payment_status IN ('paid', 'promo')
      AND b.booking_date >= CURRENT_DATE
    UNION ALL
    -- Equipment rentals: span = pickup_date through pickup_date + rental_days - 1
    SELECT
      e.item::text AS equipment_name,
      (COALESCE(r.pickup_date, r.created_at::date) + (r.rental_days - 1) * INTERVAL '1 day')::date AS end_date
    FROM equipment_rentals r,
      jsonb_array_elements_text(r.items) AS e(item)
    WHERE r.payment_status = 'paid'
      AND COALESCE(r.pickup_date, r.created_at::date) + (r.rental_days - 1) * INTERVAL '1 day' >= CURRENT_DATE
  )
  SELECT
    equipment_name,
    MAX(end_date) AS available_after
  FROM booking_items
  GROUP BY equipment_name;
$function$;

-- 2. Retention helper — returns sensitive paths older than 30 days for cleanup job
CREATE OR REPLACE FUNCTION public.cleanup_expired_sensitive_data()
RETURNS TABLE(
  source_table text,
  record_id uuid,
  id_photo_path text,
  consent_signature_path text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- Bookings older than 30 days post-session
  SELECT 'bookings'::text, id, id_photo_url, consent_signature_path
  FROM bookings
  WHERE booking_date < (CURRENT_DATE - INTERVAL '30 days')
    AND (id_photo_url IS NOT NULL OR consent_signature_path IS NOT NULL)
  UNION ALL
  -- Equipment rentals older than 30 days post-pickup
  SELECT 'equipment_rentals'::text, id, NULL::text, consent_signature_path
  FROM equipment_rentals
  WHERE COALESCE(pickup_date, created_at::date) < (CURRENT_DATE - INTERVAL '30 days')
    AND consent_signature_path IS NOT NULL
  UNION ALL
  -- Session guests older than 30 days
  SELECT 'session_guests'::text, sg.id, sg.id_photo_path, sg.consent_signature_path
  FROM session_guests sg
  WHERE sg.created_at < (now() - INTERVAL '30 days')
    AND (sg.id_photo_path IS NOT NULL OR sg.consent_signature_path IS NOT NULL);
$function$;

REVOKE ALL ON FUNCTION public.cleanup_expired_sensitive_data() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_sensitive_data() TO service_role;

-- Helper to clear the sensitive columns once files are deleted
CREATE OR REPLACE FUNCTION public.clear_sensitive_data(
  p_source text,
  p_record_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_source = 'bookings' THEN
    UPDATE bookings SET id_photo_url = NULL, consent_signature_path = NULL WHERE id = p_record_id;
  ELSIF p_source = 'equipment_rentals' THEN
    UPDATE equipment_rentals SET consent_signature_path = NULL WHERE id = p_record_id;
  ELSIF p_source = 'session_guests' THEN
    UPDATE session_guests SET id_photo_path = NULL, consent_signature_path = NULL WHERE id = p_record_id;
  ELSE
    RETURN false;
  END IF;
  RETURN FOUND;
END;
$function$;

REVOKE ALL ON FUNCTION public.clear_sensitive_data(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_sensitive_data(text, uuid) TO service_role;
