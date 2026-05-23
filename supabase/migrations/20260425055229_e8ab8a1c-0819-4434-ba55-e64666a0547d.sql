
-- 1) Slug on events
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS events_slug_unique ON public.events (slug) WHERE slug IS NOT NULL;

-- Backfill slugs from title for existing rows
UPDATE public.events
SET slug = lower(regexp_replace(regexp_replace(title || '-' || substr(id::text, 1, 6), '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'))
WHERE slug IS NULL;

-- 2) Ticket tiers table
CREATE TABLE IF NOT EXISTS public.event_ticket_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  capacity INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  sold_out BOOLEAN NOT NULL DEFAULT false,
  is_free BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS event_ticket_tiers_event_idx ON public.event_ticket_tiers(event_id, sort_order);

ALTER TABLE public.event_ticket_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view tiers for published events"
ON public.event_ticket_tiers FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_ticket_tiers.event_id AND e.status = 'published'
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can insert tiers"
ON public.event_ticket_tiers FOR INSERT
TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update tiers"
ON public.event_ticket_tiers FOR UPDATE
TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete tiers"
ON public.event_ticket_tiers FOR DELETE
TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_event_ticket_tiers_updated
BEFORE UPDATE ON public.event_ticket_tiers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Lineup
CREATE TABLE IF NOT EXISTS public.event_lineup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  bio TEXT,
  photo_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS event_lineup_event_idx ON public.event_lineup(event_id, sort_order);

ALTER TABLE public.event_lineup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view lineup for published events"
ON public.event_lineup FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_lineup.event_id AND e.status = 'published'
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins manage lineup insert"
ON public.event_lineup FOR INSERT
TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage lineup update"
ON public.event_lineup FOR UPDATE
TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage lineup delete"
ON public.event_lineup FOR DELETE
TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 4) Gallery
CREATE TABLE IF NOT EXISTS public.event_gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS event_gallery_event_idx ON public.event_gallery(event_id, sort_order);

ALTER TABLE public.event_gallery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view gallery for published events"
ON public.event_gallery FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_gallery.event_id AND e.status = 'published'
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins manage gallery insert"
ON public.event_gallery FOR INSERT
TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage gallery update"
ON public.event_gallery FOR UPDATE
TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage gallery delete"
ON public.event_gallery FOR DELETE
TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 5) Tier ref on RSVP
ALTER TABLE public.event_rsvps ADD COLUMN IF NOT EXISTS ticket_tier_id UUID REFERENCES public.event_ticket_tiers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS event_rsvps_tier_idx ON public.event_rsvps(ticket_tier_id);

-- 6) Storage bucket for gallery
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-gallery', 'event-gallery', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can read event gallery"
ON storage.objects FOR SELECT
USING (bucket_id = 'event-gallery');

CREATE POLICY "Admins can upload to event gallery"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'event-gallery' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update event gallery"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'event-gallery' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete event gallery"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'event-gallery' AND public.has_role(auth.uid(), 'admin'));
