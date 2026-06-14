# Phase 2 — DJ DNA Blueprint Card (visual + UX spec)

> PRIVATE planning. Design spec only — no app code. Written 2026-06-14.
> Source: the REPLAY CLUB CONCEPTS boards (DJ DNA "crystal/blueprint") + live `DjDnaPanel`.

## Intent
The single most-repeated element across all 4 concept boards is DJ DNA shown as a glowing
faceted **"blueprint crystal."** We adopt the *form* and the premium aesthetic, and
**reject the numeric scores** the concepts show (Energy 92, 89, 76…). DNA is identity, not
a grade.

## Hard rules
- Recognition-first; evidence-backed. **No Gemini, no `mix_analysis`.**
- **No AI grading, no `/100`, no overall score, no leaderboard.**
- Descriptive identity language only (mirror, not judge).
- Mobile-first; premium Replay Club aesthetic.
- Every stat exposes its **receipts** (the real tracks behind it).

## Card anatomy (top → bottom)
1. **Header** — "DJ DNA" + provenance line: *"{N} tracks identified · built from what you
   actually played."* Archetype slot is **withheld** ("Identity forming") until corpus
   centroids exist (canon V4) — never a fake archetype.
2. **The Blueprint (hero visual)** — the live axes (Coverage · Diversity · Platform reach ·
   Confidence · Depth) rendered as a **faceted polygon / constellation with gradient fill +
   glow.** The *silhouette is the identity*, not a number. Implementation: upgrade the
   current recharts radar into a stylized polygon (or SVG constellation of nodes) — **no new
   dependency.** Subtle conic-gradient halo (same technique already in `SoundDNA`).
3. **Trait chips (descriptive)** — from `deriveTraits`: *Selector · Digger · Connected Crate ·
   Loyalist · Clean Read.* Tap a chip → its **receipts** (the tracks that earned it).
4. **Signal bands — not /100** — each axis shows a **word band** (Diversity: "Wide" /
   "Focused"; Depth: "Underground-leaning" / "Mainstream-leaning"; Confidence: "Crisp" /
   "Mixed"). The underlying ratio appears on expand as **evidence** ("18 of 24 artists
   unique") — a fact, not a score.
5. **Forming / needs-data states** — genre / label / underground = *"Forming — lights up
   with enrichment"*; tempo / energy = *"Needs audio analysis (DSP)."* Honest, never faked.
6. **Footer** — provenance + a global **"Show the receipts"** evidence drawer.

## Language
Pattern words only — *more / less / wide / focused / increasing / emerging / consistent.*
Never rank words — *better / worse / above average / 92 / A-grade.* (Anti-judgment law,
`ARCHITECTURE.md` §6.)

## Aesthetic
Dark (`bg-background`), neon purple/blue gradients, glassy cards, conic-gradient glow,
`font-display` headers, `font-body` copy — consistent with the concepts and the existing
app. Mobile-first: single column; blueprint scales to container width; trait chips wrap;
receipts in a bottom drawer (`ui/drawer`), not a cramped popover.

## Shareability (future)
Design the card **self-contained** so a single screenshot reads as a complete identity —
it becomes the **shareable DNA card** once public profiles exist (Phase 1 defers that route).

## Explicitly NOT
No Gemini · no overall/`/100` score · no leaderboard · no archetype-before-corpus · no
faked depth · no new heavy dependency.

## UI Resources & Inspiration (DJ DNA)
- **recharts** (MIT, in-stack) — radar → faceted polygon for the blueprint. **Use now.**
- **visx** (MIT, ~19k★) — the bespoke crystal/constellation path *if* recharts limits the
  blueprint. **Revisit later.**
- **framer-motion** (MIT, in-stack) — reveal/morph of the blueprint + chip transitions. **Use now.**
- **Receiptify** (Eomm/receiptify) — the "receipt" stat-card aesthetic → the receipts drawer. *Inspiration.*
- **Obscurify · stats.fm** — discovery-as-personality framing for the Underground / Depth signal. *Inspiration.*
- **AVOID:** **tremor** (generic SaaS chart feel — opposite of the cinematic concept) · any
  glass/animation kit *as a dependency* (build glass in-house with Tailwind `backdrop-blur` + gradients).
- Full catalog + licenses + risks: **`ui-inspiration-research.md`**. Visual language: dark, neon
  purple/blue, faceted-crystal, gradient glow, descriptive bands — **never `/100`.**
