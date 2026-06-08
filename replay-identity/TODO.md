# Replay Identity System — Phased Roadmap

Planning only. Each phase lists **goal · build · reuse · depends on · explicitly
NOT yet**. The ordering reflects the core principle: **progression spine first,
avatar second, economy third** — so there's a retention loop before any 3D work.

> Sequencing rationale: the avatar is worthless without something to progress.
> Build the identity/XP engine (which is mostly *data* + reuse of existing
> patterns) before the expensive, risky 3D layer. Credits + shop come after
> there's a reason to spend.

---

## Phase 0 — Research

**Goal:** de-risk the unknowns before committing to architecture.

- **3D feasibility POC** — pick an approach (three.js + @react-three/fiber vs a
  hosted avatar SDK); build a throwaway mobile-first POC measuring load time, FPS,
  battery, bundle impact on a mid-range phone. This is the #1 risk.
- **Art-direction study** — define the ~70–80% realistic / streetwear-editorial
  look concretely (refs, a style frame). Decide build-vs-license for base meshes.
- **DJ-DNA spine confirmation** — align with `mix-analysis/SCORING-SPEC.md`; confirm
  `SoundDNA` (live v0) + planned Stage-B metrics are sufficient to drive unlocks.
- **Economy model** — model Replay Credits earn/spend rates; decide earnable-only
  vs purchasable (tax/fraud implications); confirm reuse of `gift_cards` atomic
  pattern.
- **Domain placement** — decide where identity tables live (separate schema /
  `id_` prefix) so the new bounded context stays clean.
- **No code.** Outputs are decisions + the POC learnings, recorded back here.

## Phase 1 — Progression Foundation (the retention core; little/no 3D)

**Goal:** a working XP / levels / achievements engine fed by real activity —
**the avatar is NOT required for this to ship value.**

- XP/levels data model; an **award engine** modeled on the loyalty milestone
  trigger (`issue_threshold_coupons_for_email`).
- **XP sources wired to real, ungameable actions, quality-weighted** (see
  `PROGRESSION-SYSTEM.md`): mix uploads (weighted by `mix_analysis` scores),
  verified event attendance, paid bookings, completed referrals, challenges.
- **Achievements/badges** tied to mix-analysis skills (great transitions, wide
  genre range, energy arcs) and to `SoundDNA` axes.
- **Unify the existing tier ladder** (`useUserTier` Bronze→Obsidian) into the
  identity status system rather than leaving it standalone.
- Surface progression in `Profile.tsx` (text/2D first); use `notifications` for
  unlock toasts.
- **Reuse:** loyalty trigger pattern, `useUserTier`, `mix_analysis`, `SoundDNA`,
  `notifications`. **NOT yet:** avatars, credits, shop.

## Phase 2 — Avatar Foundation

**Goal:** a 3D avatar that renders identity, earned (not bought).

- Add the WebGL render layer (per Phase-0 decision), **mobile-tuned (LOD,
  lazy-load, code-split)**.
- Avatar **data model** (base avatar, equipped cosmetics) — proper tables, not a
  blob.
- A small set of **DNA-driven earned cosmetics** (e.g., transition-specialist vs
  energy-specialist looks — see `AVATAR-SYSTEM.md` + `DJ-DNA-INTEGRATION.md`).
- Render the avatar on the profile.
- **Reuse:** `avatars` bucket + per-user RLS, Phase-1 achievements as unlock
  triggers. **NOT yet:** purchasable cosmetics, drops.

## Phase 3 — Replay Credits

**Goal:** one currency across the platform.

- Generic **`user_wallet` + `credit_ledger`** (concurrency-safe; modeled on
  `deduct_gift_card_balance`'s atomic single-statement pattern).
- **Earn** credits from the Phase-1 XP sources; **unify** loyalty/referral/tier
  value into credits (one economy).
- **Buy** credits via the existing Stripe rails (`create-*/verify-*-payment`,
  `stripe-webhook`, idempotency) — if Phase-0 says purchasable.
- **Reuse:** gift-card atomic pattern, Stripe rails, `stripe_disputes`/
  `refund_requests`. **NOT yet:** spending UI beyond a balance.

## Phase 4 — Shop

**Goal:** spend credits on cosmetics; streetwear-style drops.

- **`cosmetics_catalog` + `user_inventory`** (ownership) tables.
- Spend credits (atomic deduct) → grant inventory.
- **Limited drops / contention** via the `equipment_locks`/`slot_locks` +
  unique-index + 23505 pattern (stock, drop windows).
- **Event-exclusive** items tied to the existing `events` system; founder /
  artist (FUMIX) / seasonal collections.
- Admin shop/catalog panel (reuse `AdminDashboard` lazy-panel + `audit_log` +
  `admin_issue_*` patterns). Live updates via realtime.
- **Reuse:** lock/unique-index pattern, Stripe (for direct-buy items), events
  system, admin patterns. See `SHOP-SYSTEM.md`.

## Phase 5 — Profile Showcases

**Goal:** the profile becomes a personal creative space (digital studio).

- Showcase layout: **avatar + environment + DJ DNA + achievements + collections +
  history** (see `PROFILE-SHOWCASES.md`).
- **Unlockable environments** (earned or bought).
- Public/shareable identity page (carries the existing `SocialShareCard` ethos).
- **Reuse:** `profiles`, realtime, existing `Profile.tsx` structure. **NOT yet:**
  full social graph.

## Phase 6 — Long-Term Expansion

- **FUMIX / artist collections** and creator collaborations.
- **Seasonal drops** on a release calendar.
- Deeper **DNA → avatar coupling** (the avatar visibly evolves as your DNA shifts).
- **Discovery/kinship** layer (artist/DJ overlap from DNA — a *projection*, not a
  leaderboard; see `SCORING-SPEC.md`).
- Optional **marketplace / trading** (only if it fits the streetwear ethos and the
  fraud surface is acceptable).
- Possible light **community** layer — deliberately NOT competitive rankings.

---

## Dependencies & blockers (cross-phase)

- **Richer DJ DNA** depends on **recognition Stage B** (live ACRCloud) — blocked on
  Brian creating the ACRCloud File Scanning container + secrets
  (`mix-analysis/RECOGNITION-SPEC.md`). Phase 1 can ship on `SoundDNA` v0 meanwhile.
- **Mobile 3D** is the gating technical risk → Phase 0 POC must clear it before
  Phase 2 is committed.
- **Purchasable credits** → tax/fraud/legal sign-off before Phase 3 "buy".
- All implementation happens in a future scoped effort with its own migrations,
  packages, and push-review — **none in this folder.**
