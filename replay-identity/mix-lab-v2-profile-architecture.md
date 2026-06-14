# Phase 1 — V2.1 Profile Architecture Spec (Mix Lab → Profile)

> PRIVATE planning. No app code, no refactor yet. Written 2026-06-14.
> Context: `mix-lab-v2-roadmap.md`.

## The takeaway driving this
Mix Lab (DJ DNA, Track History, Recognition, Avatar, Progression) is an **identity
experience**, not an admin tool. It only lives in AdminDashboard today because that's
where the recognition plumbing was and it was the fastest fumix-gated mount. V2.1 moves
it to its real home: **Profile.**

## Current state (audited)
- **`MixLab`** (read-only, shipped `9902602`) + **`TrackRecognitionPanel`** (edit / add /
  delete / mark-unknown / **Confirm**) both live in **AdminDashboard**, behind
  `canAccessMixLab` (email allowlist `fumix.mgmt@gmail.com`). Mix Lab is a `Dialog`.
- **`Profile.tsx`** = the user's **own** profile (`/profile`, keyed to `session.user.id`;
  **no public `/u/:handle` yet**). It already has a **URL-synced tab system**:
  `activeTab ∈ {bookings, mixes, waitlist, tickets, profile}`, synced via `?tab=`.
  Renders fumix-gated `SoundDNA` / `MixLineageTree` / `MixReportCard`; the user-side
  Recognition Room is built but **disabled** (`RECOGNITION_ROOM_ENABLED=false`).
- **RLS:** `confirmed_tracklist` has an **owner-read** policy → an owner can read their own
  mix's recognition data. **A read-only Mix Lab in Profile is RLS-safe today** (no migration).

## Decisions
- **Profile tab or dedicated route?** → **Profile tab, via the existing `?tab=` pattern.**
  Profile already deep-links tabs in the URL, so `/profile?tab=lab` is *both* a tab **and**
  a shareable link — no new router needed. A standalone public route
  (`/u/:handle/lab` for a sharable DNA card) is deferred until **public profiles** exist.
- **Dialog → inline.** Admin keeps the modal; Profile renders Mix Lab **inline, full-width**
  (better mobile real estate than a modal). The 5 sub-tabs stay a horizontal-scroll bar.
- **What stays admin-only:** the **authoring/curation** flow — `TrackRecognitionPanel`
  (edit / add / delete / mark-unknown / **Confirm Tracklist** → publishes `mixes.tracklist`)
  + admin ops. The publish power never enters the casual Profile.
- **Gating during the move:** keep `canAccessMixLab` on the Profile tab → **structural move
  only; not exposed to users yet.** Normal users stay playback-only.

## Target mobile-first architecture
```
/profile  (own profile, tabbed, ?tab= deep-links)
├─ ?tab=mixes      Mixes + playback                 (existing)
├─ ?tab=lab   →    MIX LAB   (new top-level tab; inline; gated)
│      ├─ DJ DNA
│      ├─ Track History
│      ├─ Recognition (READ-ONLY recognized tracklist)
│      ├─ Avatar
│      └─ Progression
├─ ?tab=bookings / tickets / waitlist               (existing)
└─ ?tab=profile    Settings                          (existing "profile" tab)

AdminDashboard  (ops / authoring — WRITE power)
├─ Tracklist Review   (TrackRecognitionPanel: edit / add / delete)
├─ Confirm Tracklist  (publishes to mixes.tracklist)
└─ Admin Operations
```
Recognition appears in two forms — **read-only in Mix Lab (identity)** and the
**edit/Confirm authoring tool in Admin (curation)**. Clean split: *viewing your truth* vs
*editing/publishing it*.

## Migration path (no code — the plan)
1. **Refactor `MixLab.tsx`** → extract `<MixLabContent mixId>` from the `Dialog` shell
   (Admin keeps the Dialog wrapper; Profile renders the inline content). Pure presentational split.
2. **Add `"lab"`** to Profile's `activeTab` union + the tab bar, behind `canAccessMixLab`.
3. **Mix selection** (the one net-new UX piece): the Mixes tab gets an "Open in Mix Lab"
   affordance per mix → sets `?tab=lab&mix=<id>`. Single-mix model retained from Tier-0.
4. **Admin authoring panel unchanged.**
5. **Later (V2.1-C):** flip the gate fumix → all users after the Slice-2 RLS fix.

## Dependencies / blockers
- ✅ Owner-read RLS already supports it — **no migration, no backend** for Phase 1.
- ⚠️ **Mix-selection UX** is net-new (Tier-0 was one Admin-picked mix).
- ⚠️ **Cross-mix career DNA** = V2.2 (only fumix has a scanned mix today).
- 🔗 **Slice-2 RLS fix** (owner pre-confirm tautology `j.mix_id=j.mix_id` →
  `=confirmed_tracklist.mix_id`; user edits write `source="user_edit"`) gates *user editing*
  — **not** the read-only move.
- 🔗 Phase 1 is a **pure frontend refactor + mount move.** No src-of-truth change.

## PROFILE vs ADMIN — the domain split (document clearly)
The permanent shape: **Profile = the DJ's evolving identity; Admin = the publishing/editing workspace.**

| PROFILE (identity) | ADMIN (authoring / curation) |
|---|---|
| identity · discovery · history · evolution | authoring · curation · edit / add / delete · **Confirm Tracklist** |
| read-only Mix Lab at `/profile?tab=lab` | `TrackRecognitionPanel` (write power) |
| DJ DNA · Track History · Recognition (read-only) · Avatar · Progression | Tracklist Review · Confirm → publishes `mixes.tracklist` · admin ops |

Recognition lives in **both** — read-only as **identity** (Profile), edit/Confirm as
**curation** (Admin). The publish/destructive power never enters the casual Profile. **Stop
investing in the Admin Dashboard Mix Lab beyond what's needed to move it.**

## Mobile-First Principles (Profile Mix Lab)
- **Full-page inline** experience (not a modal); `?tab=lab` deep-link via the existing tab system.
- Sticky **horizontal-scroll** sub-tab bar: Recognition · DJ DNA · Track History · Avatar · Progression.
- Single-column cards, **bottom-drawer receipts**, ≥44px tap targets, safe-area insets, responsive viz.
- Full principles + design system + UI catalog: **`ui-inspiration-research.md`**.
