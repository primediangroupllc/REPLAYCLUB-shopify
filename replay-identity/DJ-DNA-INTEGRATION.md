# DJ DNA Integration

DJ DNA is the **engine** of the identity system — *who you are as a DJ*, measured
from your actual mixes. The avatar, unlocks, levels, and showcase all read off it.
Canonical design lives in `mix-analysis/SCORING-SPEC.md`; this doc records how it
plugs into the Identity System and what already exists.

## What already exists TODAY (not vapor)

### `SoundDNA.tsx` — a working DJ-DNA v0
Computed per user, recency-weighted across all analyzed mixes:

| Axis | How it's computed |
|---|---|
| **Energy** | recency-weighted avg of each mix's `energy_score` |
| **Transitions** | recency-weighted avg of `transition_score` |
| **Creativity** | avg of per-mix `energy_profile` stddev × 4 (swing/variation) |
| **Genre Range** | (unique genres / 6) × 100 |
| **Consistency** | 100 − stddev(`overall_score`) × 4 |
| **Overall** | recency-weighted avg of `overall_score` |
Plus `topGenres`, `totalMixes`, `avgScore`.

### `mixes.mix_analysis` — the real per-mix data feeding it (Gemini, today)
`overall_score`, `transition_score`, `energy_score` (0–100); `genres[]`;
`energy_profile[10]`; `transition_details[]` (`position_pct`, `technique` ∈
{eq_blend, bass_swap, hard_cut, filter_sweep, echo_out, cue_juggle, double_drop,
tease, false_start}, `quality`, `note`); `strengths[3]`; `improvements[3]`;
`summary`; `analyzed_at`. Plus `waveform_data` ({peak,bass,mid,high}[]) and
`tracklist` ({title,artist}[]).

## What's COMING (recognition Stage B — designed, blocked on ACRCloud container)

Per-track `bpm`, `musical_key`, `genre`, `energy_level`, `popularity_score`,
`confidence`, `source` → enables the richer `SCORING-SPEC.md` metrics (harmonic
mixing, originality/crate depth, genre fingerprint). DNA gets deeper once this
lands; the Identity System ships on the v0 axes meanwhile.

> Canonical DJ-DNA model = `mix-analysis/SCORING-SPEC.md`: progression-not-grading,
> 6 universal **genre-agnostic** Profile axes + genre-aware **Mix Context**,
> genre-relative normalization, similar-artists as a *projection* of the DNA vector
> (kinship, not ranking). The Identity System should consume that model, not fork it.

## How DNA drives the avatar (the differentiator)

The avatar **visually reflects** DJ DNA. Specialists look different:

| DNA emphasis | Signal | Unlock flavor |
|---|---|---|
| **Transition specialist** | high `transition_score`, clean `bass_swap`/`double_drop` | mixing-craft cosmetics |
| **Energy specialist** | high `energy_score` / strong `energy_profile` arc | energy/peak-time looks |
| **Genre explorer** | wide `genres[]` / high Genre Range | eclectic/selector looks |
| **Consistency-focused** | high Consistency axis | refined/signature looks |
| (deep/hypnotic vs peak-time archetypes) | DNA vector shape | distinct identity paths |

Two DJs at the same **level** can look meaningfully different because their **DNA**
differs. As DNA shifts over time (`SCORING-SPEC` progression/"Eras"), the avatar
can visibly evolve (Phase 6).

## Integration points

- **Progression:** DNA axes seed achievements/badges (`PROGRESSION-SYSTEM.md`).
- **Avatar:** DNA emphasis gates earned cosmetics (`AVATAR-SYSTEM.md`).
- **Showcase:** the DNA radar/identity card is a centerpiece of the profile
  (`PROFILE-SHOWCASES.md`).
- **Discovery (future):** kinship from DNA overlap — a projection, never a ranking.

## Principle

DNA is **descriptive identity, not a grade.** Cosmetics reward *expressing and
growing* an identity, not topping a ladder. Keep this stance consistent with
`SCORING-SPEC.md` so we never drift into competitive ranking.
