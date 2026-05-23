-- Density settings columns
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS booking_buffer_minutes integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS daily_session_cap integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS shared_room_pool boolean NOT NULL DEFAULT true;

-- Public reader for density-only fields (safe; no sensitive settings exposed)
CREATE OR REPLACE FUNCTION public.get_booking_density_settings()
RETURNS TABLE(
  booking_buffer_minutes integer,
  daily_session_cap integer,
  shared_room_pool boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(booking_buffer_minutes, 30),
    COALESCE(daily_session_cap, 4),
    COALESCE(shared_room_pool, true)
  FROM public.site_settings
  ORDER BY id LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_booking_density_settings() TO anon, authenticated;

-- Cross-type day-load reader: returns booked times for a given date across
-- ALL room types (used when shared_room_pool is on).
CREATE OR REPLACE FUNCTION public.get_day_booked_times(p_booking_date date)
RETURNS TABLE(booking_time text, room_title text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT booking_time, room_title
  FROM public.bookings
  WHERE booking_date = p_booking_date
    AND payment_status IN ('paid', 'promo');
$$;

GRANT EXECUTE ON FUNCTION public.get_day_booked_times(date) TO anon, authenticated;

-- Day count (cheaper than fetching rows) for cap enforcement
CREATE OR REPLACE FUNCTION public.get_day_booking_count(p_booking_date date)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.bookings
  WHERE booking_date = p_booking_date
    AND payment_status IN ('paid', 'promo');
$$;

GRANT EXECUTE ON FUNCTION public.get_day_booking_count(date) TO anon, authenticated;