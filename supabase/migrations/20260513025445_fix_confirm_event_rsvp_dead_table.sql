-- Audit #14 — confirm_event_rsvp_with_capacity referenced bookings_dummy_skip,
-- a table that never existed in the schema. The dead SELECT was a refactor scar
-- but it caused the RPC to throw "relation does not exist" the moment Postgres
-- tried to parse the FROM clause. Every event-ticket purchase landed on this
-- RPC via verify-event-ticket-payment, then auto-refunded because the catch
-- branch fires. Customer impact: paying users got no ticket + a refund.
--
-- Fix: drop the dead block, keep the real FOR-UPDATE lock on event_rsvps.
CREATE OR REPLACE FUNCTION public.confirm_event_rsvp_with_capacity(
  p_rsvp_id uuid,
  p_ticket_code text
)
RETURNS TABLE (
  success boolean,
  over_capacity boolean,
  already_confirmed boolean,
  rsvp_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_capacity int;
  v_confirmed_count int;
  v_current_status text;
BEGIN
  -- Lock the rsvp row
  SELECT event_id, payment_status
    INTO v_event_id, v_current_status
  FROM event_rsvps
  WHERE id = p_rsvp_id
  FOR UPDATE;

  IF v_event_id IS NULL THEN
    RETURN QUERY SELECT false, false, false, p_rsvp_id;
    RETURN;
  END IF;

  IF v_current_status = 'paid' THEN
    RETURN QUERY SELECT true, false, true, p_rsvp_id;
    RETURN;
  END IF;

  -- Lock event and count confirmed
  SELECT capacity INTO v_capacity FROM events WHERE id = v_event_id FOR UPDATE;

  SELECT COUNT(*) INTO v_confirmed_count
  FROM event_rsvps
  WHERE event_id = v_event_id
    AND payment_status = 'paid'
    AND status = 'confirmed';

  IF v_confirmed_count >= v_capacity THEN
    -- Mark as waitlist instead
    UPDATE event_rsvps
    SET status = 'waitlist',
        payment_status = 'refund_pending'
    WHERE id = p_rsvp_id;
    RETURN QUERY SELECT false, true, false, p_rsvp_id;
    RETURN;
  END IF;

  UPDATE event_rsvps
  SET status = 'confirmed',
      payment_status = 'paid',
      ticket_code = COALESCE(ticket_code, p_ticket_code)
  WHERE id = p_rsvp_id;

  RETURN QUERY SELECT true, false, false, p_rsvp_id;
END;
$$;
