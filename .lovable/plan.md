## Booking Tab Images — Phase 1

Add DB-backed, admin-managed image sets for the four booking type tabs (DJ Session, Podcast, Studio Sesh, Backdrop/Photoshoot), replacing hardcoded images, with a fallback so the live site never breaks.

### 1. Database & Storage (migration)

Create enum + table + storage bucket + RLS:

- `CREATE TYPE booking_tab_type AS ENUM ('dj_session', 'podcast', 'studio_sesh', 'backdrop');`
- `public.booking_tab_images`:
  - `id uuid pk default gen_random_uuid()`
  - `booking_type booking_tab_type not null`
  - `storage_path text not null` (path inside `booking-tab-images` bucket)
  - `display_order int not null default 0`
  - `is_active bool not null default true`
  - `width int`, `height int`, `bytes int`, `mime_type text` (captured at upload, used for admin thumbnails + lazy sizing)
  - `created_at`, `updated_at` timestamptz, with `update_updated_at_column` trigger
  - index on `(booking_type, display_order)`
- RLS:
  - `SELECT` allowed to public (anon+authenticated) where `is_active = true`
  - `SELECT` allowed to admins for all rows (so they can manage inactive too)
  - `INSERT/UPDATE/DELETE` only when `has_role(auth.uid(), 'admin')`
- Storage bucket `booking-tab-images` (public = true).
  - `storage.objects` SELECT: public for `bucket_id='booking-tab-images'`
  - `INSERT/UPDATE/DELETE` on that bucket: admins only via `has_role`

### 2. Shared client helpers

- `src/lib/bookingTabImages.ts`:
  - `BookingTabType` union matching enum
  - `fetchActiveTabImages(type)` → returns ordered `{ id, url, width, height }[]` from DB (with `getPublicUrl`); empty array if none
  - `buildSrcSet(url, widths)` — reuse the same Supabase render-endpoint trick as `OptimizedImage` for responsive sizes
- `src/hooks/useBookingTabImages.ts`:
  - React Query hook keyed by booking type, returns `{ images, loading }`
  - Used by all four booking pages

### 3. Customer-facing wiring

For each booking page, keep current hardcoded imports as fallback. If hook returns ≥1 image, render those instead, ordered by `display_order`. Wrap each image in a click handler that opens a lightbox.

Pages to touch (only swap the image source + add lightbox trigger; layout untouched):

- `src/pages/DJStudio.tsx` → `dj_session`
- `src/pages/PodcastStudio.tsx` → `podcast`
- `src/pages/StudioSesh.tsx` → `studio_sesh`
- `src/pages/Photoshoot.tsx` + `src/pages/BackdropsLanding.tsx` → `backdrop` (use the same set on both, since "Backdrop/Photoshoot" is one booking type per spec)

New shared component: `src/components/ImageLightbox.tsx`
- Built on existing shadcn `Dialog`
- Full-screen on mobile (`sm:max-w-[95vw]` etc.), large centered on desktop
- Keyboard arrows + swipe (touch start/end delta) for navigation
- Close button (top-right), index indicator (`2 / 5`)
- Only renders nav controls when `images.length > 1`

All `<img>` use `loading="lazy"`, `decoding="async"`, and the responsive `srcset` helper.

### 4. Admin UI

New page: `src/pages/AdminBookingTabImages.tsx` mounted under existing admin area, wrapped in `AdminTwoFactorGate` (same pattern as `AdminSettings.tsx`). Add route in `App.tsx` and a link in the admin nav.

Layout: shadcn `Tabs` with 4 tabs (one per booking type). Each tab:

- Drag-and-drop / file input upload (multi-file). Validate per file:
  - mime ∈ {jpg, png, webp}
  - size ≤ 5 MB
  - read dimensions client-side via `Image()` and warn (non-blocking) if `width < 1200`
- Upload flow:
  1. Upload to `booking-tab-images/<booking_type>/<uuid>.<ext>`
  2. Insert row with captured `width/height/bytes/mime_type` and `display_order = max+1`
- Thumbnail grid of existing images (active + inactive, admins see all):
  - Show width×height, file size (KB/MB)
  - Toggle active/inactive (Switch)
  - Delete (with confirm) → removes storage object + DB row
  - Drag-to-reorder using `@dnd-kit/core` + `@dnd-kit/sortable` (already installed if present; otherwise add). On drop, batch-update `display_order` for affected rows.

### 5. Verification

- Run a migration linter pass.
- Manually verify the four customer pages still render with hardcoded fallback (DB empty initially).
- Confirm admin page loads behind 2FA gate, allows upload/reorder/toggle/delete.
- Confirm lightbox opens on click and supports keyboard + swipe.

### Technical notes

- Bucket public so we can use `getPublicUrl` + Supabase render transforms (consistent with `OptimizedImage`).
- We do NOT touch checkout, Stripe Identity, or booking logic.
- "Backdrop" enum value covers both Photoshoot and Backdrops landing image displays — same set, per spec ("Backdrop/Photoshoot" treated as one booking type).
- Phase 2 (layout variants) is explicitly out of scope.

### Files

New:
- `supabase/migrations/<ts>_booking_tab_images.sql`
- `src/lib/bookingTabImages.ts`
- `src/hooks/useBookingTabImages.ts`
- `src/components/ImageLightbox.tsx`
- `src/pages/AdminBookingTabImages.tsx`

Edited:
- `src/pages/DJStudio.tsx`, `PodcastStudio.tsx`, `StudioSesh.tsx`, `Photoshoot.tsx`, `BackdropsLanding.tsx` (image source + lightbox only)
- `src/App.tsx` (route)
- Admin nav (wherever the admin links live — confirmed during implementation)

Proceeding will start with the migration; I'll request your approval on it before writing code.