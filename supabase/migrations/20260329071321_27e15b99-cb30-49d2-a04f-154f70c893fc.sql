
-- Function to get completed booking count for a user email
CREATE OR REPLACE FUNCTION public.get_loyalty_info(user_email text)
RETURNS json
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT json_build_object(
    'booking_count', COALESCE(
      (SELECT COUNT(*)::int FROM bookings 
       WHERE lower(customer_email) = lower(user_email) 
       AND payment_status IN ('paid', 'promo')),
      0
    )
  );
$$;
