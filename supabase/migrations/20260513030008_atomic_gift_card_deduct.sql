-- Audit #5 — gift card balance race. create-booking-payment used to read
-- the balance, compute newBalance = balance - amount client-side, then
-- update — two concurrent redemptions of the same card both saw the same
-- pre-deduct balance and over-credited.
--
-- This RPC does the deduct atomically. The `code` check is included so the
-- function can't be abused to deduct from arbitrary cards.
CREATE OR REPLACE FUNCTION public.deduct_gift_card_balance(
  p_gift_card_id uuid,
  p_code text,
  p_amount_cents integer,
  p_booking_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance int;
  v_actual_amount int;
BEGIN
  IF p_amount_cents IS NULL OR p_amount_cents < 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_amount');
  END IF;

  -- Atomic clamp-and-deduct. Skips rows that are already fully redeemed or
  -- have an insufficient balance + caller passed a non-clamped amount.
  -- Caller (create-booking-payment) clamps amount to balance before calling,
  -- so the deduct should always succeed if the card is valid.
  UPDATE public.gift_cards
  SET
    balance_cents = GREATEST(balance_cents - p_amount_cents, 0),
    redeemed_at = CASE
      WHEN balance_cents - p_amount_cents <= 0 THEN now()
      ELSE redeemed_at
    END,
    redeemed_by_booking_id = COALESCE(redeemed_by_booking_id, p_booking_id)
  WHERE id = p_gift_card_id
    AND code = p_code
    AND payment_status = 'paid'
    AND balance_cents >= p_amount_cents
    AND (redeemed_at IS NULL OR balance_cents > 0)
  RETURNING balance_cents INTO v_new_balance;

  IF v_new_balance IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'not_found_or_insufficient_balance'
    );
  END IF;

  v_actual_amount := p_amount_cents;
  RETURN jsonb_build_object(
    'success', true,
    'amount_deducted_cents', v_actual_amount,
    'new_balance_cents', v_new_balance
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.deduct_gift_card_balance(uuid, text, integer, uuid) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.deduct_gift_card_balance(uuid, text, integer, uuid) TO service_role;
