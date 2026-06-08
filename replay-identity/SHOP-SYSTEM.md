# Shop System (Avatar Shop)

The shop should feel like a **streetwear release calendar**, not a game cosmetics
store / loot box. Drops, collections, founder pieces, artist collabs, seasonal
releases — closer to culture than gaming.

## Vision — what's for sale

- **Cosmetic items** — clothing, accessories, looks for the avatar.
- **Limited drops** — finite stock and/or time-boxed windows.
- **Event exclusives** — tied to the existing `events` system (attend X → eligible).
- **Founder items** — early-supporter / early-member pieces (status signifiers).
- **Artist collections** — incl. **FUMIX** collections and guest-artist collabs.
- **Seasonal collections** — on a release calendar.

Spent with **Replay Credits** (`REPLAY-CREDITS.md`); some premium/charity items may
be direct Stripe buys.

## Tone

- Drops feel *curated and cultural*, with stories/lookbooks — not RNG crates.
- Scarcity is **honest** (real stock/time limits), surfaced clearly.
- Founder/artist/event items are **identity/status markers**, the point being
  *what owning it says about you*, not raw stats.

## Reuse (the backend is surprisingly ready)

- **Limited drops / contention:** the `equipment_locks` / `slot_locks` pattern
  (TTL holds + unique index + 23505-on-conflict handling) is a proven
  limited-inventory/no-double-allocation mechanism — the template for drop stock.
- **Purchase rails:** Stripe `create-*/verify-*-payment`, `stripe-webhook`,
  `stripe_checkout_idempotency`, `stripe_disputes` (for direct-buy items + buying
  Credits).
- **Spend Credits:** the atomic `deduct_gift_card_balance()` pattern → wallet
  deduct (`REPLAY-CREDITS.md`).
- **Admin catalog/minting:** `admin_issue_gift_card()` + `AdminDashboard`
  lazy-panel pattern + `audit_log`/`admin_audit_log` → a shop/catalog admin panel.
- **Live shop/drop updates:** the realtime `postgres_changes` pattern (publish the
  new shop tables) → real-time "sold out"/stock counters.
- **Event-exclusive eligibility:** join to `event_rsvps.checked_in_at`
  (verified attendance) — drops you can only get by *being there*.

## What's missing (greenfield)

- **`cosmetics_catalog`** — items, art refs (storage), price (Credits/$), stock,
  drop window, collection/season, eligibility rules.
- **`user_inventory`** — per-user ownership of cosmetics (the thing that makes a
  cosmetic "yours"). Today nothing tracks item ownership beyond bookings/rentals.
- Drop scheduling + eligibility logic (event-gated, founder-gated, level-gated).

## Phasing

`TODO.md` Phase 4 — after Credits exist (Phase 3) and there's an avatar to dress
(Phase 2). Start with a simple catalog + Credit spend + owned-inventory; add drops,
exclusivity, and artist/seasonal collections after the basics are solid. Founder
items can be an early signature drop once the shop exists.

## Guardrails

- Honest scarcity; clear pricing; no dark patterns.
- Real-money paths inherit the existing fraud/refund/dispute handling.
- Keep shop tables in the identity bounded context; reuse rails without entangling
  with booking payments.
