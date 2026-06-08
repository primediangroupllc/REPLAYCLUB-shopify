# Progression System (XP · Levels · Achievements · Badges)

The progression engine is the **retention core** and the **spine** the avatar
renders. It ships value *before* any 3D work (`TODO.md` Phase 1).

## Principle: one spine, fed by real growth

- The DJ-DNA/progression design in `mix-analysis/SCORING-SPEC.md` IS this spine.
  `SoundDNA.tsx` is a working v0. Build it once; the avatar skins it.
- **XP from real growth, gameable-proof:** weight by the scores that already exist
  (a great mix > a posted mix) and by ungameable actions (real money, admin-
  verified presence, completed referrals).
- **Style axes, not quality grades** — progression recognizes *identity* and
  *growth*, not rank. NOT a leaderboard.

## XP sources (quality × un-gameability)

From the trackable-actions analysis:

| Action | Writes | Frequency | XP quality | Notes |
|---|---|---|---|---|
| **Mix analysis / report card** | `mixes.mix_analysis` | per upload | ⭐⭐ best | **quality-weighted** by `overall/transition/energy_score` — rewards getting better |
| **Mix upload** | `mixes` | occasional→regular | ⭐ core | the creative act; diminishing returns to prevent spam |
| **Verified event attendance** | `event_rsvps.checked_in_at` (admin) | rare | ⭐ excellent | ungameable (admin-verified presence) |
| **Paid session booking** | `bookings` | occasional | ⭐ strong | costs real money; already drives tiers/loyalty |
| **Completed referral** | `referrals` | rare | ⭐ excellent | growth-driving; referee must pay |
| **Challenge entry** | `challenge_entries` | periodic | ⭐ great | engagement + competitive hook |
| Tracklist confirm/edit | `confirmed_tracklist` | per mix | good | rewards curation/completeness |
| Recognition request | `mix_recognition_jobs` | 1/mix | minor | feature engagement (guardrailed) |
| Event RSVP | `event_rsvps` | occasional | moderate | cheap → cap it |
| Challenge vote | `challenge_votes` | periodic | small | community participation |
| Equipment rental | `equipment_rentals` | rare | moderate | |
| Account/profile/notifications | `profiles`,`notifications` | once/freq | onboarding/none | don't reward noise |

**Anti-grind rules:** cap volume-based XP with diminishing returns; reserve the
big XP for quality-scored output and money/presence-verified actions.

## Achievements & badges — tied to DJ skill

Achievements map to the **real** `mix_analysis` data, enabling Brian's "great
transitions unlock one thing, song selection another":

- Transitions: high `transition_score`; first clean `double_drop`/`bass_swap`;
  technique mastery (from `transition_details[].technique`).
- Energy: a strong `energy_profile` arc (build→peak→comedown).
- Selection: wide `genres[]` / high Genre Range; deep cuts (Stage-B
  `popularity_score`).
- Consistency / Creativity (the `SoundDNA` axes).
- Platform milestones: paid-session thresholds, attendance streaks, challenge wins.

Achievements are the **unlock triggers** for cosmetics (`AVATAR-SYSTEM.md`) and
emit `notifications`.

## Reuse (don't reinvent)

- **Milestone → reward engine:** `issue_threshold_coupons_for_email()` + trigger
  `trg_bookings_issue_loyalty_coupons` is already a working "hit N → grant reward"
  pattern. The XP/achievement award engine follows this shape.
- **Status/tier ladder:** `useUserTier` (New Member→Bronze→Silver→Gold→Platinum→
  Diamond→Obsidian, by paid bookings) is the existing status skeleton — **fold it
  into identity status**, don't run a second ladder beside it.
- **`SoundDNA`** (Energy, Transitions, Creativity, Genre Range, Consistency,
  Overall): the live identity vector to formalize.
- **`notifications`**: unlock/level-up delivery.

## Levels

Levels = a readable summary of accumulated XP, gating environments/cosmetics and
feeding the showcase. Keep curves humane (this is identity, not a grind). Tie level
flavor to DNA archetype where possible (a "deep selector" level path can feel
different from a "peak-time" one) — reinforces identity over ranking.
