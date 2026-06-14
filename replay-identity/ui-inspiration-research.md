# UI Inspiration & GitHub Research (Mix Lab / Identity layer)

> PRIVATE planning + research. **Documentation only — nothing installed, no deps added,
> no code copied, package.json untouched.** Written 2026-06-14. Feeds the V2.1 docs.
> Licenses/stars are best-effort as of research date — **verify before ever adopting.**

## Governing principle (read first)
**Stay in the stack we already have** — `shadcn/ui` + Radix + Tailwind + `framer-motion`
+ `recharts` + `lucide`. Build the premium / glass / cinematic look **ourselves** with
those (the concepts' aesthetic is achievable with Tailwind gradients + framer-motion — same
technique already in `SoundDNA`'s conic-gradient glow). Add a **new dependency only when it
buys something we genuinely can't hand-roll** (waveform rendering; 3D) — **one at a time,
deliberately.** This directly defends against the four named risks: dependency weight,
generic SaaS feel, gimmicky gamification, aesthetic mismatch.

---

## 1. Already in the stack — USE NOW
| Resource | License | Activity | Useful for | Fits |
|---|---|---|---|---|
| **shadcn/ui** (ui.shadcn.com) | MIT | very active | tabs, drawer, dialog, card, badge, hover-card | everything |
| **framer-motion / motion** | MIT | very active | premium motion, reveal, blueprint animation | DJ DNA · Avatar · Profile |
| **recharts** (github.com/recharts/recharts) | MIT | ~18.8k★, huge | radar / polygon / bars | **DJ DNA** · Progression |
| **lucide-react** | ISC | very active | icon set | all |
**Recommendation:** these are the spine. No action needed.

## 2. Data-viz for the DJ DNA Blueprint
| Resource | License | Stars | Useful | Fits | Rec | Risk |
|---|---|---|---|---|---|---|
| **recharts** | MIT | 18.8k | radar→faceted polygon (already used) | DJ DNA | **use now** | low |
| **visx** (airbnb/visx) | MIT | ~19k | low-level D3+React for a *bespoke* crystal/constellation blueprint | DJ DNA | **revisit later** (if recharts limits the blueprint) | adds D3 surface area |
| **nivo** (plouc/nivo) | MIT | ~13k | polished radar/treemap/calendar | DJ DNA · Track History | inspiration only | heavier than recharts |
| **tremor** (tremorlabs) | Apache-2.0 | ~16k | pre-styled shadcn-matching charts | — | **avoid for DNA** | ⚠️ **generic SaaS feel** — the opposite of the cinematic concept |

## 3. Audio / waveform (Recognition Timeline + future player)
| Resource | License | Stars | Useful | Fits | Rec | Risk |
|---|---|---|---|---|---|---|
| **wavesurfer.js** + **@wavesurfer/react** (katspaugh) | BSD-3 *(verify)* | ~10k | real waveform + region overlays for recognized segments | **Recognition Timeline** · player | **revisit later** (single best pick when we upgrade the timeline) | one real dep; mind mobile decode cost (pre-decode peaks) |
| **peaks.js** (bbc/peaks.js) | ⚠️ **LGPL-3.0** | ~3k | segment/region waveform | Recognition Timeline | inspiration only | ⚠️ **copyleft** — verify before bundling |
| **audioMotion-analyzer** | ⚠️ **AGPL-3.0** | ~1k | real-time spectrum | (vanity viz) | **avoid** | ⚠️ AGPL = strong copyleft; not for prod |
**Note:** the current `RecognitionTimeline` (hand-rolled) is fine for now; wavesurfer is the
upgrade path, not a today-need.

## 4. Premium animation / "wow" component kits (inspiration)
| Resource | License | Useful | Rec | Risk |
|---|---|---|---|---|
| **Aceternity UI** (ui.aceternity.com) | ⚠️ free components / **commercial** license | hero glow, card beams, motion patterns | **inspiration only** — recreate with our Tailwind+framer | licensing; copy-paste lock-in |
| **Magic UI** (magicuidesign/magicui) | MIT core / premium templates *(verify per-component)* | animated badges/cards/number tickers | **inspiration only** | verify license per component |
| **Inspira UI** (unovue/inspira-ui) | MIT | open clone of the above | inspiration only | ⚠️ **Vue/Nuxt — framework mismatch** (we're React) |
**Recommendation:** study these for *motion ideas*; build in-house. Do **not** add as deps.

## 5. Glass / chrome aesthetic
| Resource | License | Useful | Rec | Risk |
|---|---|---|---|---|
| **FrostGlass** (xvhuan/frostglass) · **Quidlass** · **@mawtech/glass-ui** · **ui-glassmorphism** (AKAspanion) | mostly MIT *(verify)* | frosted-glass component patterns | **inspiration only** | ⚠️ small/new/immature; dependency-weight + maintenance risk |
**Recommendation:** **build glass ourselves** — `backdrop-blur` + translucent `bg-*/10` +
gradient borders in Tailwind. No glass library is mature enough to depend on; they're
reference for *recipes*, not packages.

## 6. Progression / achievement presentation
| Resource | License | Useful | Fits | Rec | Risk |
|---|---|---|---|---|---|
| **Trophy Gamification UI Kit** (ui.trophy.so) | open-source *(verify)*, shadcn-based | badge grids, milestone/achievement cards, unlock animations | **Progression** · Avatar milestones | **inspiration / use carefully** — *milestone presentation ONLY* | ⚠️ **gimmicky gamification** — it ships **streaks + leaderboards + points**, which we **AVOID** (Withholding Doctrine / no ranking). Cherry-pick the achievement-card look, drop the grind/leaderboard parts |
| **react-activity-calendar** (grubersjoe) | MIT | GitHub-style contribution heatmap | Progression · **Track History / Journey** ("mixes over time" without grind bars) | **revisit later** | low; keep it identity-framed, not a streak |

## 7. 3D avatar / spaces (FAR FUTURE — design only)
| Resource | License | Stars | Useful | Fits | Rec | Risk |
|---|---|---|---|---|---|---|
| **@react-three/fiber + drei** (pmndrs) | MIT | ~28k / ~8k | React renderer for three.js — the avatar/scene path | **Avatar** · Environment | **revisit later** (post mobile-WebGL POC) | mobile GPU/perf; biggest net-new lift |
| **three.js** | MIT | ~104k | 3D engine under r3f | Avatar | revisit later | as above |
| **Spline / @splinetool/react-spline** | MIT runtime / proprietary editor | — | fast 3D scenes w/o raw three.js — quick avatar/space POC | Avatar · Environment | **inspiration / POC** | editor is SaaS; runtime payload weight |
| **Ready Player Me** | ⚠️ commercial SDK (free tier + ToS) | — | hosted 3D avatar SDK (skips asset pipeline) | Avatar | **revisit later / evaluate** | ToS; may clash with the streetwear/editorial art direction |

## 8. Reference products — STUDY, do not import
| Product | Useful as inspiration for |
|---|---|
| **Spotify Wrapped** | annual identity reveal pacing (but we reject the score/rank framing) |
| **stats.fm** (github.com/statsfm) | dense listening-identity presentation |
| **Last.fm** | history/scrobble timeline, artist/label affinity surfaces |
| **Obscurify** | *discovery → personality* (obscurity as identity) — informs our Underground signal |
| **Receiptify** (Eomm/receiptify) | the **"receipt" stat-card** aesthetic → our receipts UI |
| **Discogs** | **collection-as-status** → Track History "crate" + future Collections |
| **your_spotify** (Yooooomi/your_spotify) | ⚠️ **AGPL** — *inspiration only*, never import; self-hosted dashboard layout ideas |

---

## Visual Language (Replay Club)
- **Dark, cinematic, editorial** — near-black `bg-background`, neon **purple/blue** accents,
  glass/chrome surfaces. Luxury streetwear + underground club, **not** game-cosmetics, **not** SaaS analytics.
- **Faceted "blueprint/crystal"** as the DNA motif (from the concept boards).
- **Glow via gradients** — conic/radial gradient halos (the `SoundDNA` technique), `backdrop-blur` glass.
- **Restraint** — few signals, chosen for leverage (canon: *remember less than you could*). One
  blueprint, a few traits, one signature — never a wall of metrics.
- **Typography** — `font-display` (uppercase, tracked) for labels/headers; `font-body` for prose.

## Mobile-First Principles
- **Full-page > modal** for the Profile Mix Lab (modals are cramped on phones).
- **Sticky, horizontally-scrollable tab bar** for the 5 sub-tabs.
- **Single-column cards**, `p-3` padding, `min-w-0` + `truncate`, `flex-wrap` meta rows.
- **Bottom drawers** (`ui/drawer`) for receipts/evidence — not hover popovers (no hover on touch).
- **≥44px tap targets**; **safe-area insets**; respect the **SW cache-clear ritual** when QA'ing.
- **Responsive viz** — blueprint/radar in a width-responsive container; no fixed pixel canvases.

## Replay Club Design System Direction
1. **One stack:** shadcn + Tailwind + framer-motion + recharts + lucide. Extend, don't replace.
2. **Build the premium look in-house** (glass, glow, blueprint) — no glass/animation library deps.
3. **Add a dep only for a genuine capability gap, one at a time:** `wavesurfer.js` (waveform,
   when we upgrade the timeline) → `@react-three/fiber` (3D avatar, post-POC). Nothing else queued.
4. **Reuse existing tokens/palette** — `bg-background`, `border-border`, `text-primary`, the
   recognition status palette (`SEGMENT_STATUS_META`), the SoundDNA glow.
5. **Guardrails:** no generic SaaS chart kits (tremor) for identity; no leaderboard/streak/points
   UI (Trophy's grind parts); no AGPL/copyleft deps without explicit legal sign-off.
