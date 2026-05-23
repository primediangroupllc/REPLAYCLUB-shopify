-- Audit #1 — route ID-verification decisions through audited, admin-gated RPCs
-- instead of direct client-side UPDATEs on bookings / session_guests.
--
-- Both tables already restrict UPDATE to admins via RLS. These functions add a
-- server-side has_role preflight + an audit_log row for every decision, and give
-- the frontend a single chokepoint that survives any future RLS drift.

-- ── Bookings ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_booking_id_verification(
  p_booking_id uuid,
  p_decision text
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_before public.bookings;
  v_after public.bookings;
BEGIN
  IF v_admin_id IS NULL OR NOT public.has_role(v_admin_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden: admin role required' USING ERRCODE = '42501';
  END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'invalid decision: % (expected approved|rejected)', p_decision
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_before FROM public.bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking not found: %', p_booking_id USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.bookings
  SET id_verified = p_decision
  WHERE id = p_booking_id
  RETURNING * INTO v_after;

  INSERT INTO public.audit_log (admin_user_id, action, entity_type, entity_id, details)
  VALUES (
    v_admin_id,
    CASE WHEN p_decision = 'approved' THEN 'approve' ELSE 'reject' END,
    'booking_id_verification',
    p_booking_id::text,
    jsonb_build_object(
      'customer_name',  v_after.customer_name,
      'customer_email', v_after.customer_email,
      'before',         v_before.id_verified,
      'after',          v_after.id_verified
    )
  );

  RETURN v_after;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_booking_id_verification(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_booking_id_verification(uuid, text) TO authenticated;

-- ── Session guests ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_guest_id_verification(
  p_guest_id uuid,
  p_decision text
)
RETURNS public.session_guests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_before public.session_guests;
  v_after public.session_guests;
BEGIN
  IF v_admin_id IS NULL OR NOT public.has_role(v_admin_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden: admin role required' USING ERRCODE = '42501';
  END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'invalid decision: % (expected approved|rejected)', p_decision
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_before FROM public.session_guests WHERE id = p_guest_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'guest not found: %', p_guest_id USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.session_guests
  SET id_verified = p_decision
  WHERE id = p_guest_id
  RETURNING * INTO v_after;

  INSERT INTO public.audit_log (admin_user_id, action, entity_type, entity_id, details)
  VALUES (
    v_admin_id,
    CASE WHEN p_decision = 'approved' THEN 'approve' ELSE 'reject' END,
    'guest_id_verification',
    p_guest_id::text,
    jsonb_build_object(
      'guest_name',        v_after.guest_name,
      'session_invite_id', v_after.session_invite_id,
      'before',            v_before.id_verified,
      'after',             v_after.id_verified
    )
  );

  RETURN v_after;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_guest_id_verification(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_guest_id_verification(uuid, text) TO authenticated;
