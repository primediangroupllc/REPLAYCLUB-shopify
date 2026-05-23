-- =========================================================================
-- backdrops table
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.backdrops (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  description text,
  image_url   text,
  is_active   boolean     NOT NULL DEFAULT true,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS backdrops_sort_idx ON public.backdrops(sort_order, name);

ALTER TABLE public.backdrops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can view active backdrops" ON public.backdrops;
CREATE POLICY "anyone can view active backdrops"
  ON public.backdrops FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "admins manage backdrops" ON public.backdrops;
CREATE POLICY "admins manage backdrops"
  ON public.backdrops FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS touch_backdrops_updated_at ON public.backdrops;
CREATE TRIGGER touch_backdrops_updated_at
  BEFORE UPDATE ON public.backdrops
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add to realtime publication (idempotent)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.backdrops;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- Storage bucket + policies
INSERT INTO storage.buckets (id, name, public)
VALUES ('backdrop-images', 'backdrop-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "backdrop images public read" ON storage.objects;
CREATE POLICY "backdrop images public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'backdrop-images');

DROP POLICY IF EXISTS "admins upload backdrop images" ON storage.objects;
CREATE POLICY "admins upload backdrop images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'backdrop-images' AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "admins update backdrop images" ON storage.objects;
CREATE POLICY "admins update backdrop images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'backdrop-images' AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'backdrop-images' AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "admins delete backdrop images" ON storage.objects;
CREATE POLICY "admins delete backdrop images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'backdrop-images' AND public.has_role(auth.uid(), 'admin'::app_role));

-- Seed
INSERT INTO public.backdrops (name, description, sort_order, is_active) VALUES
  ('Black Abyss Backdrop',  'Floor-to-ceiling matte black velvet drapes for moody, cinematic shoots and DJ sets.', 1, true),
  ('Greenscreen Backdrop',  'Pro chroma-key green pull-down for livestreams and post-production keying.',          2, true),
  ('Office White Backdrop', 'Clean neutral wall — perfect for podcasts, interviews, and product shots.',           3, true),
  ('Wood Grid Backdrop',    'Warm wood-slat acoustic panel for a textured, organic look.',                        4, true)
ON CONFLICT DO NOTHING;

-- =========================================================================
-- bookings: new columns
-- =========================================================================
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS backdrop        text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS custom_requests text;

-- =========================================================================
-- RPCs
-- =========================================================================
DROP FUNCTION IF EXISTS public.upsert_draft_booking(text, date, text, text, text, text, text, jsonb, text, text, text, integer);
CREATE OR REPLACE FUNCTION public.upsert_draft_booking(
  p_room_title text,
  p_booking_date date,
  p_booking_time text,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_tier text,
  p_equipment jsonb,
  p_lighting text,
  p_sound text,
  p_layout text,
  p_amount_cents integer,
  p_backdrop text DEFAULT NULL,
  p_custom_requests text DEFAULT NULL
)
RETURNS TABLE(booking_id uuid, reused boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing uuid;
  v_new uuid;
  v_lock_expiry timestamptz := now() + interval '30 minutes';
  v_email text := lower(p_customer_email);
BEGIN
  SELECT id INTO v_existing
  FROM public.bookings
  WHERE lower(customer_email) = v_email
    AND room_title = p_room_title
    AND booking_date = p_booking_date
    AND booking_time = p_booking_time
    AND payment_status = 'pending'
    AND verification_status IN ('pending_id_upload', 'pending_ocr')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    UPDATE public.bookings
    SET customer_name = p_customer_name,
        customer_phone = COALESCE(NULLIF(p_customer_phone, ''), customer_phone),
        tier = COALESCE(p_tier, tier),
        equipment = COALESCE(p_equipment, equipment),
        lighting = COALESCE(p_lighting, lighting),
        sound = COALESCE(p_sound, sound),
        layout = COALESCE(p_layout, layout),
        backdrop = COALESCE(p_backdrop, backdrop),
        custom_requests = COALESCE(p_custom_requests, custom_requests),
        amount_cents = p_amount_cents,
        verification_held_until = now() + interval '24 hours'
    WHERE id = v_existing;

    INSERT INTO public.slot_locks (
      room_title, booking_date, booking_time,
      locked_by_email, expires_at, booking_id
    )
    VALUES (
      p_room_title, p_booking_date, p_booking_time,
      v_email, v_lock_expiry, v_existing
    )
    ON CONFLICT (room_title, booking_date, booking_time)
    DO UPDATE SET
      expires_at = GREATEST(public.slot_locks.expires_at, EXCLUDED.expires_at),
      locked_by_email = EXCLUDED.locked_by_email,
      booking_id = EXCLUDED.booking_id
    WHERE public.slot_locks.locked_by_email = v_email
       OR public.slot_locks.expires_at <= now();

    RETURN QUERY SELECT v_existing, true;
    RETURN;
  END IF;

  INSERT INTO public.bookings (
    room_title, booking_date, booking_time,
    customer_name, customer_email, customer_phone,
    tier, equipment, lighting, sound, layout,
    backdrop, custom_requests,
    amount_cents,
    payment_status,
    verification_status,
    verification_held_until
  )
  VALUES (
    p_room_title, p_booking_date, p_booking_time,
    p_customer_name, v_email, COALESCE(p_customer_phone, ''),
    p_tier, COALESCE(p_equipment, '[]'::jsonb), p_lighting, p_sound, p_layout,
    p_backdrop, p_custom_requests,
    p_amount_cents,
    'pending',
    'pending_id_upload',
    now() + interval '24 hours'
  )
  RETURNING id INTO v_new;

  INSERT INTO public.slot_locks (
    room_title, booking_date, booking_time,
    locked_by_email, expires_at, booking_id
  )
  VALUES (
    p_room_title, p_booking_date, p_booking_time,
    v_email, v_lock_expiry, v_new
  )
  ON CONFLICT (room_title, booking_date, booking_time)
  DO UPDATE SET
    expires_at = GREATEST(public.slot_locks.expires_at, EXCLUDED.expires_at),
    locked_by_email = EXCLUDED.locked_by_email,
    booking_id = EXCLUDED.booking_id
  WHERE public.slot_locks.locked_by_email = v_email
     OR public.slot_locks.expires_at <= now();

  RETURN QUERY SELECT v_new, false;
END;
$function$;

DROP FUNCTION IF EXISTS public.rebook_existing_booking(uuid, text, date, text, text, jsonb, text, text, text, integer);
CREATE OR REPLACE FUNCTION public.rebook_existing_booking(
  p_booking_id uuid,
  p_room_title text,
  p_booking_date date,
  p_booking_time text,
  p_tier text,
  p_equipment jsonb,
  p_lighting text,
  p_sound text,
  p_layout text,
  p_amount_cents integer,
  p_backdrop text DEFAULT NULL,
  p_custom_requests text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_old_room text;
  v_old_date date;
  v_old_time text;
  v_email text;
  v_caller_email text;
  v_verification_status text;
  v_paid boolean;
  v_locked_by_other boolean;
  v_lock_expiry timestamptz := now() + interval '30 minutes';
BEGIN
  SELECT room_title, booking_date, booking_time,
         lower(customer_email), verification_status
    INTO v_old_room, v_old_date, v_old_time, v_email, v_verification_status
  FROM public.bookings
  WHERE id = p_booking_id;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'booking not found: %', p_booking_id;
  END IF;

  IF v_verification_status <> 'approved' THEN
    RAISE EXCEPTION 'rebook only allowed for approved bookings (got: %)', v_verification_status;
  END IF;

  IF auth.role() <> 'service_role' THEN
    v_caller_email := lower(COALESCE(auth.jwt() ->> 'email', ''));
    IF v_caller_email = '' OR v_caller_email <> v_email THEN
      RAISE EXCEPTION 'not authorized to rebook this booking';
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE room_title = p_room_title
      AND booking_date = p_booking_date
      AND booking_time = p_booking_time
      AND payment_status IN ('paid', 'promo')
      AND id <> p_booking_id
  ) INTO v_paid;
  IF v_paid THEN
    RAISE EXCEPTION 'slot_already_booked';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.slot_locks
    WHERE room_title = p_room_title
      AND booking_date = p_booking_date
      AND booking_time = p_booking_time
      AND expires_at > now()
      AND lower(locked_by_email) <> v_email
      AND COALESCE(booking_id, '00000000-0000-0000-0000-000000000000'::uuid) <> p_booking_id
  ) INTO v_locked_by_other;
  IF v_locked_by_other THEN
    RAISE EXCEPTION 'slot_locked_by_other';
  END IF;

  UPDATE public.bookings
  SET room_title = p_room_title,
      booking_date = p_booking_date,
      booking_time = p_booking_time,
      tier = COALESCE(p_tier, tier),
      equipment = COALESCE(p_equipment, equipment),
      lighting = COALESCE(p_lighting, lighting),
      sound = COALESCE(p_sound, sound),
      layout = COALESCE(p_layout, layout),
      backdrop = COALESCE(p_backdrop, backdrop),
      custom_requests = COALESCE(p_custom_requests, custom_requests),
      amount_cents = p_amount_cents
  WHERE id = p_booking_id;

  IF v_old_room IS NOT NULL AND v_old_date IS NOT NULL AND v_old_time IS NOT NULL
     AND (v_old_room <> p_room_title OR v_old_date <> p_booking_date OR v_old_time <> p_booking_time)
  THEN
    DELETE FROM public.slot_locks
    WHERE room_title = v_old_room
      AND booking_date = v_old_date
      AND booking_time = v_old_time
      AND lower(locked_by_email) = v_email;
  END IF;

  INSERT INTO public.slot_locks (
    room_title, booking_date, booking_time,
    locked_by_email, expires_at, booking_id
  )
  VALUES (
    p_room_title, p_booking_date, p_booking_time,
    v_email, v_lock_expiry, p_booking_id
  )
  ON CONFLICT (room_title, booking_date, booking_time)
  DO UPDATE SET
    expires_at = GREATEST(public.slot_locks.expires_at, EXCLUDED.expires_at),
    locked_by_email = EXCLUDED.locked_by_email,
    booking_id = EXCLUDED.booking_id
  WHERE public.slot_locks.locked_by_email = v_email
     OR public.slot_locks.expires_at <= now();

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'lock_expires_at', v_lock_expiry
  );
END;
$function$;