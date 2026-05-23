-- Audit #7 Phase 2 (photoshoot) — give Photoshoot a server-side price table.
--
-- create-booking-payment recomputes studio charges from studio_configurations
-- and ignores the client amount, but Photoshoot had no row, so its price was
-- still browser-trusted. This adds the photoshoot row; the edge function's
-- STUDIO_KEY_BY_ROOM gets a "Photoshoot" -> "photoshoot" entry in the same
-- patch. Tiers mirror the hardcoded ones in src/pages/Photoshoot.tsx — the
-- recompute matches a tier by the hourly price token in the client string.
INSERT INTO public.studio_configurations (studio_key, display_name, description, sort_order, tiers)
VALUES (
  'photoshoot',
  'Photoshoot',
  'Flexible photo space with multiple backdrops, pro lighting, and an optional in-house photographer.',
  50,
  '[
    {
      "id": "lighting-space",
      "label": "Lighting + Space",
      "price_cents_per_hour": 7000,
      "features": [
        "Backdrop access",
        "Pro key/fill lighting",
        "Bring your own photographer"
      ]
    },
    {
      "id": "camera-included",
      "label": "Camera Included",
      "price_cents_per_hour": 11000,
      "features": [
        "Sony FX3 or Canon 90D",
        "Pro lens kit",
        "Lighting + backdrop"
      ]
    },
    {
      "id": "full-content",
      "label": "Full Content Setup",
      "price_cents_per_hour": 16500,
      "features": [
        "Camera + advanced lighting",
        "Backdrop choice",
        "On-set technical support"
      ]
    }
  ]'::jsonb
)
ON CONFLICT (studio_key) DO NOTHING;
