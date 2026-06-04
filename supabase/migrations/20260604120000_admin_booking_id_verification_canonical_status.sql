-- PROD-GAP fix: make admin ID approve/reject actually unblock/block the customer,
-- so Stripe-Identity bookings routed to manual review can be hand-decided.
--
-- ── CANONICAL-COLUMN DECISION (Design A) for public.bookings ──────────────────
--   * verification_status  = CANONICAL. The customer's gate to proceed is
--       `verification_status = 'approved'` (read in Index.tsx, ServiceLandingPage,
--       BookingModal, create-identity-verification-session). stripe-webhook writes
--       it: 'approved' | 'pending_admin_review' | 'rejected'.
--   * id_verified          = LEGACY / display-only. NO customer path reads it;
--       only AdminDashboard renders it as a badge. We keep mirroring it here so the
--       badge keeps working, but it is NOT a gate.
--
-- The prior RPC (20260518030000) wrote ONLY id_verified, so an admin "Approve" set
-- a non-gate column and the customer stayed stuck at `pending_admin_review`. This
-- redefine writes the CANONICAL verification_status (and clears the 24h review
-- hold), while still mirroring id_verified + writing the same audited audit_log row.
--
-- SCOPE: public.session_guests is a SEPARATE model — it has NO verification_status
-- column; its id_verified IS canonical (AdminCheckIn gates check-in on it). So
-- admin_set_guest_id_verification is deliberately left UNCHANGED by this migration.

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
  SET id_verified             = p_decision,   -- legacy badge mirror (NOT a gate)
      verification_status     = p_decision,   -- CANONICAL customer gate ('approved'|'rejected')
      verification_held_until = NULL,         -- release the 24h admin-review slot hold
      decline_reason = CASE WHEN p_decision = 'rejected'
                            THEN COALESCE(decline_reason, 'admin_rejected')
                            ELSE decline_reason END
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
      'before', jsonb_build_object('id_verified', v_before.id_verified, 'verification_status', v_before.verification_status),
      'after',  jsonb_build_object('id_verified', v_after.id_verified,  'verification_status', v_after.verification_status)
    )
  );

  RETURN v_after;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_booking_id_verification(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_booking_id_verification(uuid, text) TO authenticated;
