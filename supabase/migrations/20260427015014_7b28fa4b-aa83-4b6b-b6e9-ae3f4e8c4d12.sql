-- ============================================================
-- Studio Configurations
-- One row per studio. Layouts/tiers/addons stored as JSONB so
-- admins can fully manage them without schema changes.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.studio_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  layouts jsonb NOT NULL DEFAULT '[]'::jsonb,
  tiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  addons jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.studio_configurations ENABLE ROW LEVEL SECURITY;

-- Public read: the customer booking flow needs this data.
CREATE POLICY "Studio configurations are viewable by everyone"
  ON public.studio_configurations
  FOR SELECT
  USING (true);

-- Admin-only writes (insert/update/delete) using the existing has_role gate.
CREATE POLICY "Admins can insert studio configurations"
  ON public.studio_configurations
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update studio configurations"
  ON public.studio_configurations
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete studio configurations"
  ON public.studio_configurations
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Auto-update updated_at on every change.
CREATE TRIGGER studio_configurations_set_updated_at
  BEFORE UPDATE ON public.studio_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Seed: migrate existing hardcoded studio data into editable rows.
-- Uses ON CONFLICT (studio_key) DO NOTHING so re-running is safe.
-- ============================================================

INSERT INTO public.studio_configurations
  (studio_key, display_name, description, sort_order, layouts, tiers, addons)
VALUES
  -- ---------- MUSIC (new recording studio) ----------
  (
    'music',
    'Music',
    'Hybrid recording studio for tracking, vocals, and full-band sessions.',
    10,
    '[
      {"id":"tracking-room","name":"Tracking Room","description":"Open live room with iso pads — best for guitars, keys, and hybrid arrangements."},
      {"id":"vocal-booth","name":"Vocal Booth Focus","description":"Treated booth + control room workflow for clean vocal takes and overdubs."},
      {"id":"full-band","name":"Full Band Setup","description":"Drum kit area, multi-mic configuration, and headphone mixes for live tracking."}
    ]'::jsonb,
    '[
      {
        "id":"self-serve",
        "label":"Self-Serve",
        "price_cents_per_hour":7500,
        "features":["Room + console access","Pre-patched mic lines","Headphone mixes","2-hour minimum"]
      },
      {
        "id":"engineered",
        "label":"Engineered",
        "price_cents_per_hour":12500,
        "features":["Tracking engineer included","Mic selection & setup","Pro Tools / Logic templates","Same-day rough mix","2-hour minimum"]
      },
      {
        "id":"premium",
        "label":"Premium Production",
        "price_cents_per_hour":18500,
        "features":["Senior engineer + assistant","Vintage mic locker access","Outboard processing","Same-day stems + rough mix","Mixing session credit","2-hour minimum"]
      }
    ]'::jsonb,
    '[
      {"id":"extra-engineer-hour","name":"Additional Engineer Hour","description":"Add an extra hour with the tracking engineer outside the booked block.","price_cents":7500,"unit":"flat"},
      {"id":"mix-master","name":"Mix & Master (per song)","description":"Full mixdown plus mastering pass for one song, delivered within 5 days.","price_cents":25000,"unit":"flat"},
      {"id":"mic-locker-addon","name":"Vintage Mic Locker Add-On","description":"Unlock the U87, C800, and BACH 195 for your session.","price_cents":4500,"unit":"flat"},
      {"id":"prophet-rental","name":"Prophet 8 Synth","description":"Add the Prophet 8 to your session.","price_cents":7500,"unit":"flat"},
      {"id":"acoustic-guitars","name":"Acoustic Guitar Pair","description":"ART & Lutherie + Lava acoustics ready to track.","price_cents":3500,"unit":"flat"}
    ]'::jsonb
  ),

  -- ---------- DISK JOCKEY ----------
  (
    'dj',
    'Disk Jockey',
    'DJ rehearsal and recording space with industry-standard equipment, custom lighting, and multiple backdrop options.',
    20,
    '[
      {"id":"black-abyss","name":"Black Abyss","description":"Deep black void backdrop"},
      {"id":"greenscreen","name":"Greenscreen","description":"Chromakey for custom visuals"},
      {"id":"office-white","name":"Office White","description":"Clean minimal white backdrop"},
      {"id":"wood-grid","name":"Wood Grid","description":"Warm textured wood panel wall"}
    ]'::jsonb,
    '[
      {
        "id":"self-service",
        "label":"Self-Service",
        "price_cents_per_hour":5500,
        "features":["XDJ-AZ access","Headphones","Self-setup","2-hour minimum"]
      },
      {
        "id":"lighting-setup",
        "label":"Lighting + Setup",
        "price_cents_per_hour":8000,
        "features":["Full gear setup","Custom lighting rig","Background choice","2-hour minimum"]
      },
      {
        "id":"with-fx3",
        "label":"With FX3 Recording",
        "price_cents_per_hour":11500,
        "features":["Sony FX3 recording","4K dashcam angle","Custom lighting","Background choice","2-hour minimum"]
      }
    ]'::jsonb,
    '[
      {"id":"essentials","name":"Essentials","description":"Everything you need for a solid set","price_cents":0,"unit":"bundle","includes":["AlphaTheta XDJ-AZ","DT 990 Pro Headphones"]},
      {"id":"performance","name":"Performance","description":"Full setup with dashcam, lighting & backdrop","price_cents":0,"unit":"bundle","includes":["AlphaTheta XDJ-AZ","DT 990 Pro Headphones","Sony 4K FDR-X3000","Custom Lighting Setup","Custom Background"]},
      {"id":"showtime","name":"Showtime","description":"The complete experience with pro recording & visuals","price_cents":0,"unit":"bundle","includes":["AlphaTheta XDJ-AZ","DT 990 Pro Headphones","Sony FX3","Sony 4K FDR-X3000","Custom Lighting Setup","Custom Background","JBL 305P MKii 5\"","LED Light Bar x2"]}
    ]'::jsonb
  ),

  -- ---------- PODCAST ----------
  (
    'podcast',
    'Podcast',
    'Soundproofed podcast suite with professional microphones, multi-camera video, and a distraction-free environment.',
    30,
    '[
      {"id":"black-abyss","name":"Black Abyss","description":"Deep black void backdrop"},
      {"id":"greenscreen","name":"Greenscreen","description":"Chromakey for custom visuals"},
      {"id":"office-white","name":"Office White","description":"Clean minimal white backdrop"},
      {"id":"wood-grid","name":"Wood Grid","description":"Warm textured wood panel wall"}
    ]'::jsonb,
    '[
      {
        "id":"audio-only",
        "label":"Audio Only",
        "price_cents_per_hour":6000,
        "features":["Professional mic setup","Acoustic-treated room","1- or 2-hour sessions"]
      },
      {
        "id":"audio-video",
        "label":"Audio + Video Recording",
        "price_cents_per_hour":8500,
        "features":["Multi-cam video","Pro mic setup","Background choice","1- or 2-hour sessions"]
      },
      {
        "id":"audio-edit",
        "label":"Audio + Full Edit",
        "price_cents_per_hour":6000,
        "features":["Pro mic setup","Full audio edit (mix + master)","Acoustic-treated room","1- or 2-hour sessions"],
        "flat_addon_cents":15000
      },
      {
        "id":"audio-video-edit",
        "label":"Audio + Video + Full Edit",
        "price_cents_per_hour":8500,
        "features":["Multi-cam video","Pro mic setup","Full audio edit (mix + master)","Background choice"],
        "flat_addon_cents":15000
      }
    ]'::jsonb,
    '[
      {"id":"v7-mic","name":"SC Electronics V7 Mic","description":"Add an extra V7 mic to the session.","price_cents":2500,"unit":"flat"},
      {"id":"dji-wireless","name":"DJI Wireless Mic","description":"Wireless lavalier for mobile segments.","price_cents":1500,"unit":"flat"},
      {"id":"dt-990","name":"DT 990 Pro Headphones","description":"Open-back monitoring headphones.","price_cents":1000,"unit":"flat"},
      {"id":"dt-770","name":"DT 770 Headphones","description":"Closed-back tracking headphones.","price_cents":1000,"unit":"flat"}
    ]'::jsonb
  ),

  -- ---------- LIVESTREAM ----------
  (
    'livestream',
    'Livestream',
    'Custom-tailored livestream and broadcast packages — multi-cam, audio mixing, and real-time streaming.',
    40,
    '[
      {"id":"single-cam","name":"Single Camera","description":"Single-cam talking head or DJ stream."},
      {"id":"multi-cam","name":"Multi-Camera","description":"Multi-cam mix with switcher control."},
      {"id":"event-broadcast","name":"Event Broadcast","description":"Full event coverage with engineer + producer."}
    ]'::jsonb,
    '[
      {
        "id":"inquiry",
        "label":"Custom Quote",
        "price_cents_per_hour":0,
        "features":["Configured per event","Multi-camera available","Pro audio mixing","Real-time streaming"]
      }
    ]'::jsonb,
    '[
      {"id":"sony-fx3","name":"Sony FX3","description":"Cinema camera for hero angles.","price_cents":11500,"unit":"daily"},
      {"id":"canon-90d","name":"Canon 90D","description":"Secondary DSLR camera angle.","price_cents":6500,"unit":"daily"},
      {"id":"sony-4k","name":"Sony 4K FDR-X3000","description":"Dashcam / overhead 4K angle.","price_cents":5000,"unit":"daily"},
      {"id":"rode-shotgun","name":"Rode Shotgun Mic","description":"Directional shotgun mic for clean dialog.","price_cents":2000,"unit":"daily"},
      {"id":"gvm-lighting","name":"GVM PRO-SD300B","description":"Bi-color LED key light.","price_cents":3500,"unit":"daily"}
    ]'::jsonb
  ),

  -- ---------- BACKDROPS ----------
  (
    'backdrops',
    'Backdrops',
    'Photo backdrops billed as hourly add-ons through the Equipment Rental flow.',
    50,
    '[
      {"id":"black-abyss","name":"Black Abyss","description":"Deep black void backdrop"},
      {"id":"greenscreen","name":"Greenscreen","description":"Chromakey for custom visuals"},
      {"id":"office-white","name":"Office White","description":"Clean minimal white backdrop"},
      {"id":"wood-grid","name":"Wood Grid","description":"Warm textured wood panel wall"}
    ]'::jsonb,
    '[
      {
        "id":"self-service",
        "label":"Self-Service Shoot",
        "price_cents_per_hour":0,
        "features":["Backdrop access","Use of overhead key light","No photographer included"]
      },
      {
        "id":"basic",
        "label":"Basic Photo Package",
        "price_cents_per_hour":0,
        "features":["1-hour session with our photographer","50 color-corrected photos","5-day turnaround"],
        "flat_addon_cents":25000
      },
      {
        "id":"professional",
        "label":"Professional Photographer Package",
        "price_cents_per_hour":0,
        "features":["2-hour session with senior photographer","100 fully retouched photos","3-day turnaround","Includes basic lighting setup"],
        "flat_addon_cents":45000
      },
      {
        "id":"editorial",
        "label":"Premium Editorial Package",
        "price_cents_per_hour":0,
        "features":["3-hour session with editorial photographer","200 fully retouched photos","Advanced lighting + on-set styling guidance","48-hour turnaround"],
        "flat_addon_cents":75000
      }
    ]'::jsonb,
    '[
      {"id":"sony-fx3","name":"Sony FX3","description":"Cinema camera add-on.","price_cents":11500,"unit":"daily"},
      {"id":"canon-90d","name":"Canon 90D","description":"DSLR add-on.","price_cents":6500,"unit":"daily"},
      {"id":"canon-7020","name":"Canon 70-200mm Lens","description":"Telephoto zoom lens.","price_cents":4500,"unit":"daily"},
      {"id":"prism-lenses","name":"Prism FX Lenses x4","description":"Prism filter set.","price_cents":3000,"unit":"daily"},
      {"id":"gvm-lighting","name":"GVM PRO-SD300B","description":"Bi-color LED key light.","price_cents":3500,"unit":"daily"},
      {"id":"led-bars","name":"LED Light Bar x2","description":"Pair of LED light bars.","price_cents":2000,"unit":"daily"},
      {"id":"pro-lighting-bundle","name":"Pro Lighting Package","description":"GVM PRO-SD300B + 2x LED Light Bars + 2x ring lights.","price_cents":5500,"unit":"flat","includes":["GVM PRO-SD300B","LED Light Bar x2","Phone Ring Light x2"]}
    ]'::jsonb
  )
ON CONFLICT (studio_key) DO NOTHING;