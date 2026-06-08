# Replay Identity System — Vision

## Why this exists

We are not building avatars. We are building **a reason to keep coming back to
Replay Club.** The retention loop is:

```
Progress · Identity · Discovery
```

A booking site gives a reason to come back *when you need a studio*. An identity
system gives a reason to come back *to see who you're becoming as a DJ* — every
time you upload a set, play out, or grow.

## What "Identity" means

A user's Replay identity is the sum of:

- **Avatar** — the visual embodiment (3D, see `AVATAR-SYSTEM.md`)
- **DJ DNA** — who you are as a DJ, measured from your actual mixes (`DJ-DNA-INTEGRATION.md`)
- **XP & Levels** — progression earned from real activity (`PROGRESSION-SYSTEM.md`)
- **Replay Credits** — the one currency across the platform (`REPLAY-CREDITS.md`)
- **Achievements & Badges** — milestones, skill recognition
- **Collections** — owned cosmetics, drops, artist/founder items
- **Environments** — unlockable spaces for the profile/showcase
- **Status** — tier/standing (built on the existing Bronze→Obsidian ladder)
- **Profile Showcases** — the personal creative space that displays it all (`PROFILE-SHOWCASES.md`)

The **avatar is the skin**; **DJ DNA is the engine**. The avatar visually reflects
how you actually DJ.

## Major discovery — we are not starting from zero

Repository analysis (2026-06-08) found Replay Club **already contains the
foundations of progression**:

- **User tiers** — `useUserTier.ts`: New Member → Bronze → Silver → Gold →
  Platinum → Diamond → Obsidian (by paid bookings), each an escalating discount.
- **Loyalty rewards** — auto-issued coupons at 5/15/30/50 paid sessions.
- **Referral rewards** — $10 credit when a referred user books.
- **Mix analysis** — real per-mix scores (transitions, energy, genres, techniques).
- **DJ DNA metrics** — `SoundDNA.tsx` already computes a 6-axis identity vector.
- **Event attendance** — admin check-in records (verified presence).
- **Challenges** — entry + voting.
- **Notifications** — a delivery channel for unlocks/rewards.

The work is to **unify** these into one identity & economy — not to invent a
parallel one. (Full inventory in `NOTES.md`.)

## Design stances (locked from discussion)

1. **Identity + progression + discovery — NOT leaderboards/rankings.** This is a
   deliberate stance carried from `SCORING-SPEC.md` ("anti-Spotify-Wrapped"). We
   celebrate *who you are* and *how you grow*, and we surface *kinship* (artists
   you overlap with) — we do not rank DJs against each other.
2. **Style axes, not quality grades.** A hypnotic low-risk selector and a
   high-energy peak-time DJ are *different identities*, not better/worse ones.
   Cosmetics/unlocks reward expressing an identity, not topping a ladder.
3. **XP from real growth, gameable-proof.** Weight XP by the scores that already
   exist (a great mix > a posted mix) and by ungameable actions (paid bookings,
   admin-verified attendance, completed referrals).
4. **One spine, one currency.** Build the DJ-DNA/XP progression once; the avatar
   renders it. Build **Replay Credits** once; the existing tier/loyalty/referral
   engine feeds it. (See `PROGRESSION-SYSTEM.md`, `REPLAY-CREDITS.md`.)

## Cultural positioning — streetwear, not gaming

The avatar and shop should feel like **luxury streetwear + underground club
culture + creator culture + fashion/editorial photography** — *not* a game
cosmetics store.

- **Avatar style:** fully **3D**, **~70–80% realistic / ~20–30% stylized**.
  Explicitly **NOT** Roblox, **NOT** Fortnite, **NOT** Bitmoji.
- **Shop tone:** drops, collections, founder pieces, artist (incl. FUMIX)
  collaborations, seasonal releases — closer to a streetwear release calendar than
  a loot box.
- **Profile tone:** a digital studio / artist identity page, not a game lobby.

## The payoff

When it comes together: your sets define your **DJ DNA** → your DNA shapes your
**avatar, unlocks, and identity** → your **profile showcase** displays your growth,
collection, and creative space → **Replay Credits** tie activity, rewards, and the
shop into one economy. Replay Club becomes *somewhere you have an identity*, not
just somewhere you book a room.
