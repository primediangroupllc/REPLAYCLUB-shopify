
DROP VIEW IF EXISTS public.slot_locks_public;
DROP VIEW IF EXISTS public.equipment_locks_public;

CREATE OR REPLACE FUNCTION public.get_active_slot_locks()
RETURNS TABLE (
  id uuid,
  room_title text,
  booking_date date,
  booking_time text,
  expires_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, room_title, booking_date, booking_time, expires_at, created_at
  FROM public.slot_locks
  WHERE expires_at > now();
$$;

CREATE OR REPLACE FUNCTION public.get_active_equipment_locks()
RETURNS TABLE (
  id uuid,
  equipment_name text,
  pickup_date date,
  rental_days integer,
  expires_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, equipment_name, pickup_date, rental_days, expires_at, created_at
  FROM public.equipment_locks
  WHERE expires_at > now();
$$;

GRANT EXECUTE ON FUNCTION public.get_active_slot_locks() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_equipment_locks() TO anon, authenticated;
