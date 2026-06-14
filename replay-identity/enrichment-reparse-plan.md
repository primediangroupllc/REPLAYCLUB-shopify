# Phase 3 — Enrichment Re-Parse Plan (implementation plan only)

> PRIVATE planning. Plan only — no code. Written 2026-06-14.
> Recovers genre / label / release-era for DJ DNA from data we ALREADY have.

## Data reality (audited 2026-06-14, FUMIX mix `b8b95726…`, 24/24 rows)
- `confirmed_tracklist`: `title / artist / start_seconds / end_seconds / confidence /
  metadata{isrc, album, platform_ids(spotify+deezer+youtube), segment_status}` **populated**.
- `confirmed_tracklist`: `genre / bpm / musical_key / energy_level / vocal_density /
  popularity_score` = **NULL (0/24).**
- `track_metadata_cache` = **0 rows** (enrichment never ran).
- **KEY:** `recognized_track_segments.raw_response` (24 rows) **already contains**
  `label` (e.g. "HOTTRAX"), `genres`, `release_date`, `external_metadata`
  (spotify/deezer/youtube album+track+artist), `external_ids` (isrc/upc), `score`.
  **The parser simply didn't map them into `confirmed_tracklist`.**

## The insight
**Enrichment for genre / label / era = a deterministic RE-PARSE of existing `raw_response`
→ `confirmed_tracklist`. No external API, no Spotify, no LLM, no ACRCloud re-call.**

## Coverage tiers
- **Tier A — re-parse (no external call):** `genre` (from `raw_response.genres`, where
  ACRCloud supplied it — **partial** per-track), `label` → `metadata.label`, **release era**
  (from `release_date` → year/era band). *This is the bulk of the unlock.*
- **Tier B — light Spotify (gated, later):** true `popularity_score` 0–100 via the spotify
  IDs already in `metadata.platform_ids` → precise underground-vs-mainstream + discovery.
  Needs `SPOTIFY_CLIENT_ID/SECRET` + deploy.
- **Tier C — DSP (far):** `bpm / musical_key / energy_level` — NOT in catalog (Spotify
  audio-features deprecated Nov 2024); requires the MIX-STRUCTURE DSP layer.

## Implementation plan
1. **New deterministic edge fn `enrich-tracklist`** (service-role): for a mix, join each
   `confirmed_tracklist` row ↔ its `recognized_track_segments` (by mix_id + position/timing
   or title/artist), read `raw_response`, and **write** `genre`, `metadata.label`,
   `metadata.release_date` / `era` back. Idempotent. **Never touches the parser/poller;
   never re-calls ACRCloud.**
2. **No migration** — `genre` column already exists; `label` / `era` go in the existing
   `metadata` jsonb. (Optional later: promote `label` to a real column if query needs it.)
3. **Backfill** the existing FUMIX 24 once; verify coverage % (genre partial, label strong).
4. **DNA auto-lights-up:** once columns populate, `mixDna`'s genre / label / underground
   stats flip from `"forming"` → `"live"` with **zero frontend change**.

## Honesty caveat
ACRCloud `genres` coverage is **partial** (not every track) — so per-track genre stays
"partial / forming," **never fabricated.** Label coverage looked strong (real imprints).

## Blockers / sequencing
- It's a **backend deploy** (Brian's go) — not part of the frontend V2.1.
- Sequence **after Phase 1** so DNA has its Profile home to display the new fields.
- No prod-write happens without explicit per-action authorization.
