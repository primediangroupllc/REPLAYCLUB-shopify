# Mix Lab — V2.1 Roadmap (index)

> **PRIVATE planning doc.** Design only — no app code. Lives in `replay-identity/`
> (untracked; not committed/pushed). Reconciles: live Mix Lab V2 (`9902602`),
> the recognition-first architecture, the REPLAY CLUB CONCEPTS audit (4 boards),
> and the canon (`mix-analysis/`). Written 2026-06-14.

## Where we are
- **Recognition** live (Stage B / ACRCloud; FUMIX 24/24).
- **Mix Lab V2** live on prod (`9902602`), **read-only, fumix.mgmt-only**, mounted in
  AdminDashboard as a Dialog. Tabs: Recognition · DJ DNA · Track History · Avatar · Progression.
- **Concept audit complete** — 4 boards validated the direction; biggest takeaway is
  structural, not a new feature: **Mix Lab is an identity experience, not an admin tool.**

## V2.1 priority order (Brian, 2026-06-14)
1. **Mix Lab → Profile** route/tab — move the read-only identity experience to Profile.
   → `mix-lab-v2-profile-architecture.md`
2. **DJ DNA Blueprint Card** redesign — the hero visual, recognition-first, no scores.
   → `dj-dna-blueprint-card-spec.md`
3. **Enrichment re-parse** — recover genre / label / era from existing recognition data.
   → `enrichment-reparse-plan.md`
4. **Retire Gemini-era `MixReportCard`** — *later* (after DNA reaches parity). Keep both
   during V2 per the standing decision.
5. **Avatar / Environment evolution** — *later*; design captured now as the north-star.
   → `avatar-architecture-v1.md`

## Sequencing logic
Frontend-first, gated by truth: (1) and (2) are frontend-only and ship value immediately
on the existing recognition data. (3) is the cheap backend unlock that lights up DNA's
genre/label/underground (a deploy — Brian's go). (4)/(5) are gated later phases (parity,
corpus, history, 3D infra). Everything honors the canon's **truth-gates** and the
**Withholding Doctrine** (no grind/padlocks; the portrait announces, it doesn't flicker).

## Standing guardrails (apply to every doc here)
- Recognition-first; `confirmed_tracklist` is the source of truth. **No Gemini / no
  `mixes.mix_analysis` / no `/100` scores / no coaching.**
- Descriptive identity language (mirror, not judge). Every stat carries **receipts**.
- No leaderboard / no "Top 1K" / no XP grind.
- fumix.mgmt-only until V2.1-C readiness; normal users stay playback-only.
- `SoundDNA` / `MixLineageTree` left untouched until Mix Lab reaches parity.

## V2.1 build-now priorities (locked 2026-06-14)
1. **Mix Lab → Profile** route/tab (`/profile?tab=lab`) — `mix-lab-v2-profile-architecture.md`
2. **DJ DNA Blueprint Card** redesign — `dj-dna-blueprint-card-spec.md`
3. **Enrichment re-parse** (genre / label / era) — `enrichment-reparse-plan.md`
4. **MixReportCard retirement plan** — retire the Gemini-era `/100` card *after* DNA reaches parity (keep both during V2).

## Parked — DO NOT BUILD YET (named north-stars, each gated)
Archetype naming (corpus/V4) · 3D spaces · Environment evolution · Artifacts · Collections ·
Shop · Community layer · Legacy systems. Captured in `avatar-architecture-v1.md`; each waits
on its gate (corpus / history / 3D infra / community scale). Designing them now ≠ building them.

## Design & UI direction
Full GitHub/UI catalog (resources · licenses · fit · recommendation · risks) +
**Visual Language**, **Mobile-First Principles**, and **Replay Club Design System Direction**
live in **`ui-inspiration-research.md`**. Headline: **stay in our stack** (shadcn + Tailwind +
framer-motion + recharts), **build the premium/glass look in-house**, add a dependency only for
a real capability gap (`wavesurfer.js` → `@react-three/fiber`), one at a time. No glass /
animation / SaaS-chart libraries; no leaderboard/streak/grind UI.
