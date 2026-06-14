# Phase 4 — Avatar Architecture V1

> PRIVATE planning. Architecture doc — no app code, no build. Written 2026-06-14.
> Sources: REPLAY CLUB CONCEPTS audit (Environment Evolution; Origin→Established arc),
> the `replay-identity/` workspace (AVATAR / PROGRESSION / DJ-DNA-INTEGRATION), and the
> `mix-analysis/` canon (Withholding Doctrine; behavior-not-popularity; tier ladder).

## Principle
**The avatar is the skin; DJ DNA is the engine.** It visualizes *who you are* (from real
recognition) and **evolves as you actually play** — it is never a grind reward or a rank.

## Reconciliation with the concept boards (keep / change)
| Concept element | Decision |
|---|---|
| Environment / Avatar **Evolution** Origin→Growing→Established→Iconic→Legendary | ✅ keep the *evolution*; ❌ drop the **numeric levels (L1/15/30/50/75)** → tie stages to **real identity tiers** (mixes recognized 1 / 3 / 10 / 25+) + DNA stability |
| **"Top 1K" / Legacy Score** | ❌ drop — no ranking (canon law: ranks behavior, not popularity) |
| XP bars / % / grind | ❌ none — Withholding Doctrine (no padlocks / progress bars) |
| Origin → Established **narrative arc** | ✅ adopt as the honest identity-tier story (earned by volume, shown plainly) |
| "Real AI analysis / your data, yours / always evolving" | ✅ core principle |

## Architecture layers
1. **Identity source = DJ DNA** (recognition-derived). The avatar reads the same
   `DjDnaV2` vector + traits — **one model, no parallel economy.**
2. **Avatar = a visual projection of DNA** — DNA shape / traits drive the look (a Digger
   looks different from a Selector). Descriptive, never good/bad.
3. **Evolution = state change on real, ungameable milestones** — mixes recognized (tier up),
   distinct artists / labels discovered, DNA breadth/depth shifts. Stages **announce**
   themselves ("the portrait doesn't flicker; it announces"), never a filling bar.
4. **Environment ("Your Space")** — the concept's evolving room is the **far-future 3D
   layer**; **V1 = a 2D / stylized identity scene** that changes with tier (cheap, mobile-safe).
   3D gated on a mobile-WebGL POC (no three.js/r3f in the app today — the largest net-new lift).
5. **Artifacts** — real recognized milestones *kept* (maps to canon Moments → Memory) —
   time-gated, later.

## Data model (greenfield — NO build now)
- `avatar_state` per user: tier + DNA-derived look params + current scene — **derived from**
  recognition / DNA, not a stored economy. **No XP table.**
- Reuse the existing `useUserTier` ladder (Bronze→Obsidian) only as **status flavor**, not
  as the identity driver. One spine, fed by real growth.

## Gameable-proof
Evolution is keyed to **real uploads / real crate / real DNA-shifts** — never to taps,
logins, RSVPs, or points.

## Phasing
- **V-future-1:** descriptive 2D, DNA-driven look + tier stages from real recognition. No 3D.
- **V-future-2:** richer environment evolution + artifacts (kept milestones).
- **V-future-3:** 3D avatar + spaces + cosmetics / shop (needs 3D stack + mobile POC + the
  Identity-System economy).
- **Gates:** corpus (archetype names) · history (artifacts / legacy) · 3D infra (spaces / cosmetics).

## Locked NOTs
No XP bars · no leaderboard · no "Top 1K" · no grind mechanics · no numeric scores ·
no archetype-before-corpus · no faked depth.

## UI Resources & Inspiration (Avatar / Progression) — FUTURE, design-only
- **@react-three/fiber + drei** (MIT, ~28k★) / **three.js** (MIT, ~104k★) — the 3D avatar/scene
  path. **Revisit later**, after a mobile-WebGL POC. Risk: mobile GPU/perf; the largest net-new lift.
- **Spline / @splinetool/react-spline** (MIT runtime / proprietary editor) — fast 3D scene POC
  without raw three.js. *Inspiration / POC.* Risk: SaaS editor, payload weight.
- **Ready Player Me** (⚠️ commercial SDK) — hosted avatar, skips the asset pipeline. *Evaluate later.*
  Risk: ToS; may clash with the streetwear/editorial art direction.
- **Trophy Gamification UI Kit** (shadcn-based) — milestone/achievement **card look only.**
  ⚠️ **AVOID its leaderboard / streak / points parts** (Withholding Doctrine; no ranking).
- **react-activity-calendar** (MIT) — identity-framed "mixes over time" heatmap (not a streak). *Revisit later.*
- **Discogs** — collection-as-status for the future Collections / Artifacts. *Inspiration.*
- Full catalog + risks: **`ui-inspiration-research.md`**. Locked: no XP bars, no leaderboard,
  no Top-1K, no grind — evolution is driven by **real recognition**, shown as identity.
