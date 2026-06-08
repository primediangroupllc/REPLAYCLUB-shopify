# Avatar System

The avatar is the **visual skin** of the identity. It renders DJ DNA and
progression — it is not a standalone feature. (Engine = DJ DNA + XP; see
`DJ-DNA-INTEGRATION.md`, `PROGRESSION-SYSTEM.md`.)

## Art direction (preferred, from discussion)

- **Fully 3D avatars.**
- **~70–80% realistic / ~20–30% stylized.** Editorial, not cartoon.
- Explicitly **NOT Roblox, NOT Fortnite, NOT Bitmoji.**
- **Visual inspiration:** luxury streetwear · underground club culture · creator
  culture · fashion / editorial photography.
- The avatar should read like a **fashion/identity statement**, the way a DJ's
  look is part of their brand — closer to a lookbook than a game character.

## Customization scope (vision)

- Base avatar (face/body/skin/hair).
- **Clothing & accessories** — streetwear pieces, the cosmetic surface of the shop.
- **Saved outfits** — multiple looks a user can switch between.
- **Inventory / ownership** — what cosmetics a user owns (see `SHOP-SYSTEM.md`).
- DNA-/achievement-gated unlocks (earned looks), plus shop/drop items (bought looks).

## How the avatar reflects DJ DNA (the differentiator)

Cosmetics/unlocks are tied to **how you actually DJ**, not arbitrary grinding:

- **Transition specialists** (high `transition_score`, clean techniques like
  `bass_swap`/`double_drop`) unlock **different cosmetics** than
- **Energy specialists** (strong `energy_score` / `energy_profile` arcs), than
- **Genre explorers** (wide `genres[]` / high Genre Range), than
- **Consistency-focused** DJs (high Consistency axis).

So two DJs at the same level can look meaningfully different because their DNA
differs. (Mapping detail: `DJ-DNA-INTEGRATION.md`.)

## Technical reality (from repo analysis)

- **No 3D stack exists today** — no three.js / @react-three/fiber / drei / babylon
  / pixi anywhere. This is the largest net-new lift.
- Likely approach: **three.js + @react-three/fiber** in the React 18 SPA, OR a
  hosted avatar SDK — decided by the **Phase 0 mobile POC** (`TODO.md`).
- **Mobile WebGL performance is the top risk.** Replay is mobile-heavy (eruda
  debug, tunnel hosts, Media Session API in `Profile.tsx`). Requires LOD,
  lazy-load, code-splitting, capped poly/texture budgets, graceful 2D fallback.
- **Asset pipeline** needed: glTF models, textures, compression, CDN delivery.

## Data model (greenfield — none exists)

`profiles` today is thin (`id, display_name, avatar_url, date_of_birth,
referral_code`). Avatar state needs **proper tables**, not a JSON blob:

- avatar base config (per user)
- equipped cosmetics (per user, by slot)
- saved outfits
- (ownership lives in `user_inventory` — `SHOP-SYSTEM.md`)

**Asset storage reuse:** the `avatars` bucket is public with per-user-folder RLS
(`(storage.foldername(name))[1] = auth.uid()::text`) — fits user-specific render
data; a dedicated `cosmetics` bucket may hold shared catalog assets.

## Phasing (see `TODO.md` Phase 2)

1. Earned, DNA-driven cosmetics on a base avatar, rendered on the profile.
2. Then the shop (bought cosmetics, drops) in Phase 4.
3. Then deeper DNA→avatar evolution + environments (Phase 5/6).

**Do not** start with the most ambitious 3D scene; prove mobile viability first.
