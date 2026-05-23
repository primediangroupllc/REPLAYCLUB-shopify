-- Audit #2 — route admin gift-card minting through an audited, admin-gated RPC
-- instead of a direct client-side INSERT into gift_cards.
--
-- gift_cards INSERT is already RLS-restricted to admins (the "Admins can manage
-- gift cards" FOR ALL policy has WITH CHECK has_role(...,'admin')). This RPC is
-- defense-in-depth: a has_role preflight, a server-generated code, a
-- denomination whitelist, and an audit_log row per issuance — a single
-- chokepoint that survives any future RLS drift.
CREATE OR REPLACE FUNCTION public.admin_issue_gift_card(
  p_amount_cents integer,
  p_recipient_email text DEFAULT NULL,
  p_recipient_name text DEFAULT NULL,
  p_personal_message text DEFAULT NULL
)
RETURNS public.gift_cards
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_code text;
  v_card public.gift_cards;
BEGIN
  IF v_admin_id IS NULL OR NOT public.has_role(v_admin_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden: admin role required' USING ERRCODE = '42501';
  END IF;

  -- Admin can only issue the three standard denominations (mirrors the
  -- preset buttons in AdminDashboard and the customer GIFT_CARD_PRICES).
  IF p_amount_cents IS NULL OR p_amount_cents NOT IN (2500, 5000, 10000) THEN
    RAISE EXCEPTION 'invalid gift card amount: % (allowed: 2500, 5000, 10000)', p_amount_cents
      USING ERRCODE = '22023';
  END IF;

  -- Server-generated code; retry on the (astronomically rare) collision.
  FOR attempt IN 1..6 LOOP
    v_code := 'RC-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    BEGIN
      INSERT INTO public.gift_cards (
        code, amount_cents, balance_cents, payment_status, issued_by_admin,
        recipient_email, recipient_name, personal_message
      )
      VALUES (
        v_code, p_amount_cents, p_amount_cents, 'paid', true,
        NULLIF(btrim(p_recipient_email), ''),
        NULLIF(btrim(p_recipient_name), ''),
        NULLIF(btrim(p_personal_message), '')
      )
      RETURNING * INTO v_card;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF attempt = 6 THEN
        RAISE EXCEPTION 'could not generate a unique gift card code — please retry';
      END IF;
    END;
  END LOOP;

  INSERT INTO public.audit_log (admin_user_id, action, entity_type, entity_id, details)
  VALUES (
    v_admin_id,
    'issue',
    'gift_card',
    v_card.id::text,
    jsonb_build_object(
      'code',            v_card.code,
      'amount_cents',    v_card.amount_cents,
      'recipient_email', v_card.recipient_email,
      'recipient_name',  v_card.recipient_name
    )
  );

  RETURN v_card;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_issue_gift_card(integer, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_issue_gift_card(integer, text, text, text) TO authenticated;
