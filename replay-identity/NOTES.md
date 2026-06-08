# Replay Identity System — Repository Findings & Architecture Notes

Raw findings from the codebase analysis (2026-06-08) that everything else in this
folder is grounded in. Source: the Replay Club shopify fork
(`replay club - shopify/`), Supabase project `ynpkkoqzenmctqrmtnxs`.

---

## Current stack (relevant facts)

- **Frontend:** React 18.3.1, **Vite 8** (rolldown engine → needs Node 20+ to
  build), TypeScript 5.8.3, react-router-dom 6, @tanstack/react-query 5, Radix UI
  + Tailwind 3, framer-motion 12. ~45 routes (`src/App.tsx`), ~46 pages.
- **3D / WebGL / game libraries: NONE.** No three.js / @react-three/fiber / drei /
  babylon / pixi. (This is the single biggest net-new technical lift — see
  `AVATAR-SYSTEM.md`.)
- **Backend:** Supabase Postgres; **68 Deno edge functions**; **91 tables, 67
  RPCs, 34 triggers, 3 enums** (`app_role`, `booking_tab_type`,
  `booking_tab_layout_variant`).
- **Auth:** Supabase email/password + hCaptcha + email/SMS OTP. Trigger
  `on_auth_user_created` → `handle_new_user()` creates `profiles` + assigns role.
- **Storage buckets:** `avatars` (public, per-user folder), `mixes`,
  `id-verification`, `talent-images`, `event-covers`, `event-gallery`,
  `consent-signatures`, `email-assets`, `roster-submissions`. Per-user RLS pattern:
  `(storage.foldername(name))[1] = auth.uid()::text`.
- **Realtime:** `supabase_realtime` publication on ~7 config tables;
  `postgres_changes` → react-query invalidation pattern.
- **Deploy:** Vercel SPA; GH Actions `ci.yml` + `deploy-migrations.yml`
  (`supabase db push` on `supabase/migrations/**`).

## Existing progression / reward / economy primitives (the foundation to UNIFY)

| Primitive | Where | Detail |
|---|---|---|
| **User Tier ladder** | `src/hooks/useUserTier.ts` `computeTier(paidCount)` | New Member(0) · Bronze(3) · Silver(5) · Gold(10) · Platinum(20) · Diamond(50) · Obsidian(100). Each grants a booking discount % (0–30). **Cosmetic badge + auto-discount; no privileges/unlocks.** This is the membership-ladder skeleton. |
| **Loyalty coupons** | `loyalty_coupons` + `issue_threshold_coupons_for_email()` + trigger `trg_bookings_issue_loyalty_coupons` + `loyalty_threshold_percent()` | Auto-issued at **5→10%, 15→20%, 30→35%, 50→45%** paid sessions. `redeem_loyalty_coupon()`. **This is a working "milestone → reward" engine — the template for an achievement engine.** |
| **Referrals** | `referrals` | `credit_amount_cents` = **$10**; pending→completed when referred user books a paid session. Code auto-gen on profile (`set_referral_code`). |
| **Gift cards** | `gift_cards` + `deduct_gift_card_balance()` + `admin_issue_gift_card()` + `validate-gift-card` | Stored value (`amount_cents`/`balance_cents`); **atomic concurrency-safe deduct** — the template for a credits wallet. |
| **Discount / promo codes** | `discount_codes`, `promo_codes` | flat-$ off / free room booking. |
| **Challenges** | `challenges`, `challenge_entries`, `challenge_votes` + trigger `on_vote_increment` | DJ challenge with voting. Only existing community/competitive primitive. |
| **Notifications** | `notifications` | service-role created; delivery channel for unlock/reward toasts. |

## Mix-analysis data (the progression FUEL)

**Real today** — `mixes.mix_analysis` JSONB (Gemini via `analyze-mix`):
`overall_score`, `transition_score`, `energy_score` (0–100); `genres[]`;
`energy_profile[10]`; `transition_details[]` (`position_pct`, `technique` ∈
{eq_blend, bass_swap, hard_cut, filter_sweep, echo_out, cue_juggle, double_drop,
tease, false_start}, `quality`, `note`); `strengths[3]`; `improvements[3]`;
`summary`; `analyzed_at`. Plus `mixes.waveform_data` ({peak,bass,mid,high}[]) and
`mixes.tracklist` ({title,artist}[]).

**Computed today** — `src/components/SoundDNA.tsx`, per user, recency-weighted:
**Energy, Transitions, Creativity, Genre Range, Consistency, Overall** + topGenres
+ totalMixes. (A working DJ-DNA v0. See `DJ-DNA-INTEGRATION.md`.)

**Planned (recognition Stage B)** — per-track `bpm`, `musical_key`, `genre`,
`energy_level`, `popularity_score`, `confidence`, `source` in
`recognized_track_segments` / `confirmed_tracklist` / `track_metadata_cache`.

## Reuse map — existing infra → Identity System need

| Identity need | Reuse | Gap to build |
|---|---|---|
| Credits **wallet** | `gift_cards` + `deduct_gift_card_balance()` (atomic UPDATE … GREATEST(bal-amt,0) WHERE bal>=amt) | generic `user_wallet` + `credit_ledger` |
| **Buy** credits | `create-*-payment` / `verify-*-payment` / `stripe-webhook` / `stripe_checkout_idempotency` / `stripe_disputes` | a "buy credits" product + credit-on-confirm |
| **XP / achievements** engine | loyalty milestone trigger pattern | XP/level/achievement tables + award fn |
| **Limited drops** / contention | `equipment_locks` / `slot_locks` + unique-index + 23505 handling | `cosmetics_catalog` (stock, drop windows) |
| Cosmetic **assets** | `avatars` bucket + per-user RLS | maybe dedicated `cosmetics` bucket; `user_inventory` |
| Unlock **notices** | `notifications` | wire to award events |
| Admin **catalog/minting** | `admin_issue_gift_card` + `AdminDashboard` lazy-panel pattern + `audit_log`/`admin_audit_log` | shop/cosmetics admin panel |
| Live shop/inventory | realtime `postgres_changes` | publish new tables |
| **Status/tier** | `useUserTier` ladder | extend into the identity status system |

## Technical risks / concerns (carry into Phase 0 research)

- **No 3D stack** → mobile WebGL performance, asset pipeline (glTF/textures, LOD),
  bundle size. Mobile is a primary surface (eruda debug, tunnel hosts, Media
  Session API in `Profile.tsx`).
- **No wallet / inventory / ledger / cosmetics tables** → a whole new (well-
  templated) data domain. Must be concurrency-safe.
- **`profiles` is thin** (id, display_name, avatar_url, referral_code,
  date_of_birth) → identity/avatar state needs proper tables, not a JSON blob.
- **Real money** if credits are purchasable → fraud/refund/chargeback/tax surface
  (partly covered by `stripe_disputes`/`refund_requests`).
- **Domain fit** → Replay is a booking/service app; identity is a *new bounded
  context*. Keep it cleanly separated (own schema namespace/prefix).
- **Build/process** → rolldown-vite Node-20+ requirement; shared worktree +
  parallel sessions (coordinate writes; explicit-path commits; see
  `mix-analysis/PROPOSED-TODO-STRUCTURE.md`).

## Open decisions (for Phase 0)

- 3D engine: three.js + @react-three/fiber vs a hosted avatar SDK; mobile-first POC.
- Where the identity domain lives (separate Postgres schema? table prefix `id_`?).
- Credits: earnable-only first, or purchasable from day one? (Tax/fraud implications.)
- How tightly DNA → cosmetic unlocks couple in v1 (rule-based) vs later.
- Whether a light community/discovery layer (kinship from DNA) is in scope early.

## Cross-references

- DJ DNA design (canonical): `mix-analysis/SCORING-SPEC.md`
- Recognition pipeline (feeds DNA): `mix-analysis/RECOGNITION-SPEC.md`
- Mixes are permanent identity artifacts: `mix-analysis/FOLLOWUP-FIXES.md` §1
- Workspace/worktree + write-coordination conventions:
  `mix-analysis/PROPOSED-TODO-STRUCTURE.md`
