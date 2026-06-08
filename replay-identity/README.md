# Replay Identity System — Planning Workspace

**Status:** PLANNING & ARCHITECTURE ONLY. No code, no migrations, no packages, no
changes to existing functionality. Nothing outside this `replay-identity/` folder
is touched. (Currently untracked in git — not committed/pushed.)

**Created:** 2026-06-08, from the architecture + feasibility analysis of the
Replay Club shopify fork.

---

## What this is

The **Replay Identity System** is a proposed major feature. The one-line thesis:

> Replay Club should not have an "avatar system." It should have a complete
> **Identity System** — and the avatar is just one visible part of a larger
> progression ecosystem.

The purpose of this folder is to **preserve the vision, discoveries, and
architecture** so that when implementation eventually begins, the full context
already exists in the repo.

## The non-negotiable principle

**One ecosystem, not parallel systems.** Replay Club already contains the
foundations of progression (tiers, loyalty, referrals, mix analysis, DJ DNA
metrics, challenges, notifications). The Identity System **unifies** these — it
does not bolt a second, disconnected economy beside them.

```
NOT:  Avatar Progression  +  Replay Club Rewards   (two systems)
YES:  Replay Club Identity & Progression           (one system)
```

## Identity = these components

Avatar · DJ DNA · XP · Levels · Replay Credits · Achievements · Badges ·
Collections · Environments · Status · Profile Showcases.

## File index

| File | Purpose |
|---|---|
| `VISION.md` | The product vision, cultural positioning, and design stances |
| `TODO.md` | Phased roadmap (Phase 0 → Phase 6) |
| `AVATAR-SYSTEM.md` | 3D avatar direction, tech reality, data model, DNA coupling |
| `PROGRESSION-SYSTEM.md` | XP, levels, achievements, badges; XP sources; tier unification |
| `REPLAY-CREDITS.md` | The unified currency; what feeds it; reuse + gaps |
| `DJ-DNA-INTEGRATION.md` | Existing SoundDNA + mix-analysis data → identity |
| `SHOP-SYSTEM.md` | Cosmetics shop, drops, founder/artist/seasonal collections |
| `PROFILE-SHOWCASES.md` | Profile as a digital studio / artist identity page |
| `NOTES.md` | Raw repository findings, reuse map, risks, open decisions |

## Related canonical docs (already in the repo, do not duplicate — reference)

- `mix-analysis/SCORING-SPEC.md` — the **DJ DNA & progression design** (the
  progression *spine* this system renders). Authoritative for DNA.
- `mix-analysis/RECOGNITION-SPEC.md` — the track-recognition pipeline that feeds
  richer DJ-DNA metrics (Stage B+).
- `mix-analysis/FOLLOWUP-FIXES.md` — incl. the locked decision that self-uploaded
  mixes never expire (they're permanent career/identity artifacts).

## Ground rules for this workspace

- Planning only. When implementation begins, it will be its own scoped effort with
  migrations, packages, and code — none of which happen here.
- Keep the **one-ecosystem** principle central in every doc.
- Be specific: reference real tables / functions / fields (see `NOTES.md`).
