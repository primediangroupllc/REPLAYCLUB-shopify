# Profile Showcases

The profile becomes a **personal creative space** — a digital studio / artist
identity page, not a settings screen. It's where the whole identity system is
*seen*, and the destination that ties everything together.

## The feeling

> The profile should feel like a digital studio or artist identity page.

Closer to an artist's EPK / a curated creative space than a game lobby. It's the
thing a DJ wants to **share** — their Replay identity as a flex, an intro, a
portfolio.

## What a showcase contains

- **Avatar** — interactive 3D display (the centerpiece; `AVATAR-SYSTEM.md`).
- **Environment** — an unlockable space the avatar lives in (studio, booth, club,
  rooftop…). Earned or bought; part of the look.
- **DJ DNA** — the identity card / radar (Energy, Transitions, Creativity, Genre
  Range, Consistency, Overall + archetype) — `DJ-DNA-INTEGRATION.md`.
- **Achievements & Badges** — skill + milestone recognition (`PROGRESSION-SYSTEM.md`).
- **Collections** — owned cosmetics / drops / founder / artist items
  (`SHOP-SYSTEM.md`), displayed like a wardrobe/trophy case.
- **History** — the DJ's mixes/report cards as a **permanent career timeline**
  (self-uploaded mixes never expire — `mix-analysis/FOLLOWUP-FIXES.md` §1) +
  bookings/events history.

## Reuse

- **`profiles`** + existing `Profile.tsx` (already a tabbed hub: Mixes / Bookings /
  Events / Preferences, with the waveform player) — extend, don't replace.
- **Realtime** `postgres_changes` pattern → live showcase updates (new unlock
  appears immediately).
- **`SocialShareCard`** ethos (already used for booking shares) → shareable public
  identity page.
- **Storage** (`avatars` bucket + per-user RLS) for avatar/showcase assets.

## Unlockable environments

Environments are a progression sink (earned via levels/achievements or bought with
Credits) and a big part of personalization. They should match the streetwear/club
aesthetic (`VISION.md`), not generic game backdrops.

## Public vs private

A user's showcase should be shareable as a **public identity page** (with privacy
controls). This is the closest the system gets to "social" — and deliberately
**identity-forward, not a ranked feed** (no leaderboard; kinship/discovery is a
DNA projection, per `SCORING-SPEC.md`).

## Phasing

`TODO.md` Phase 5 — once avatar, DNA, achievements, Credits, and shop exist, the
showcase composes them into one creative space. Early phases can surface DNA +
achievements in the existing `Profile.tsx` (2D) before the full 3D showcase.

## Why it matters

The showcase is the **payoff** that makes the whole loop worth it: your sets →
your DNA → your avatar/unlocks/collection → displayed in *your* space → a reason to
come back and keep building it. Without the showcase, the rest is invisible.
