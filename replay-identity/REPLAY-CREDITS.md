# Replay Credits — the unified currency

**One economy, not multiple disconnected ones.** Replay Credits is the single
currency that ties platform activity, the existing rewards engine, and the shop
together. Today the platform has *several* disconnected value systems (gift-card
cents, loyalty %, referral $, tier discount %) — Credits unifies them.

## What Credits connect (vision)

- **Mix activity** — uploading + analyzing mixes (quality-weighted, see
  `PROGRESSION-SYSTEM.md`).
- **Bookings** — paid sessions (already the basis of tiers/loyalty).
- **Referrals** — completed referrals.
- **Challenges** — entries / wins.
- **Event participation** — RSVPs + verified attendance.
- **Future rewards** — anything the platform wants to incentivize.

Earned credits are **spent** on cosmetics/drops (`SHOP-SYSTEM.md`) and can also map
to **real perks** (booking discounts) so the existing loyalty/tier value lives in
*one* wallet, not three.

## Reuse — the wallet already has a template

- **Atomic balance/deduct:** `deduct_gift_card_balance()` is a concurrency-safe
  single-statement pattern:
  ```
  UPDATE … SET balance_cents = GREATEST(balance_cents - amount, 0)
  WHERE id = ? AND balance_cents >= amount RETURNING balance_cents
  ```
  This is the exact template for a credits wallet withdrawal (no negative
  balances, race-safe).
- **Buy credits:** the Stripe rails already exist — `create-*-payment` /
  `verify-*-payment` / `stripe-webhook` / `stripe_checkout_idempotency` /
  `stripe_disputes` / `refund_requests`. A "buy credits" product reuses them
  (credit-the-wallet on confirmed payment, with the same race-handling).
- **Earn credits:** modeled on the loyalty milestone trigger pattern.
- **Admin grant:** `admin_issue_gift_card()` + `audit_log`/`admin_audit_log` show
  the audited-minting pattern.

## What's missing (greenfield to build)

- **`user_wallet`** — a per-user balance (gift cards are per-*card*, not per-user).
- **`credit_ledger`** — an append-only transaction log (earn/spend/grant/refund)
  for auditability and dispute handling. Gift cards have no generic ledger today.
- (Optional) transfer/gift between users — only if it fits the ethos + fraud risk.

## Design notes

- **Concurrency-safe by construction** (single-statement atomic updates + a
  ledger). No client-side balance trust.
- **Earnable-only first?** Phase 0 decides whether Credits are purchasable at
  launch or earned-only initially (tax/fraud/legal implications of selling
  currency). Earned-only is the lower-risk start; purchasable reuses Stripe later.
- **One currency, clear conversion:** if loyalty/referral value folds into Credits,
  define the conversion once and keep it transparent (no hidden multiple rates).
- Keep Credits in the **identity bounded context** (own tables/namespace), cleanly
  separated from booking payments even though it reuses the Stripe rails.

## Phasing

`TODO.md` Phase 3 — after there's something to progress (Phase 1) and an avatar to
dress (Phase 2), so Credits have an obvious purpose before they exist.
