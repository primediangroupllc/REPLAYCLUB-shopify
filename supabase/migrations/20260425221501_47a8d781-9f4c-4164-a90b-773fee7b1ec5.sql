CREATE TABLE IF NOT EXISTS public.events_homepage_settings (
  id integer PRIMARY KEY DEFAULT 1,
  hero_media_type text NOT NULL DEFAULT 'image',
  hero_media_url text,
  hero_headline text NOT NULL DEFAULT 'Members Events',
  hero_subheadline text NOT NULL DEFAULT 'Members-only experiences at Replay Club.',
  hero_cta_text text,
  hero_cta_link text,
  hero_overlay_opacity integer NOT NULL DEFAULT 40,
  upcoming_heading text NOT NULL DEFAULT 'Upcoming Events',
  upcoming_subheading text,
  upcoming_layout text NOT NULL DEFAULT 'list',
  upcoming_limit integer,
  past_heading text NOT NULL DEFAULT 'Past Events',
  past_show boolean NOT NULL DEFAULT true,
  notify_show boolean NOT NULL DEFAULT true,
  notify_heading text NOT NULL DEFAULT 'Get Notified',
  notify_description text NOT NULL DEFAULT 'Be the first to know when new events drop.',
  notify_button_text text NOT NULL DEFAULT 'Notify Me',
  notify_success_message text NOT NULL DEFAULT 'You''re on the list — we''ll email you when tickets drop.',
  about_show boolean NOT NULL DEFAULT true,
  about_heading text NOT NULL DEFAULT 'About the Venue',
  about_body text,
  about_address text,
  about_hours text,
  about_contact_email text,
  about_contact_phone text,
  faq_show boolean NOT NULL DEFAULT true,
  faq_heading text NOT NULL DEFAULT 'Frequently Asked Questions',
  seo_title text NOT NULL DEFAULT 'Replay Club Events',
  seo_description text,
  seo_og_image_url text,
  seo_og_title text,
  seo_og_description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT events_homepage_settings_singleton CHECK (id = 1)
);

INSERT INTO public.events_homepage_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.events_homepage_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads homepage settings"
  ON public.events_homepage_settings FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "Admins manage homepage settings"
  ON public.events_homepage_settings FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages homepage settings"
  ON public.events_homepage_settings FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.events_homepage_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  caption text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.events_homepage_gallery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads homepage gallery"
  ON public.events_homepage_gallery FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "Admins manage homepage gallery"
  ON public.events_homepage_gallery FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.events_homepage_faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.events_homepage_faqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads homepage faqs"
  ON public.events_homepage_faqs FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "Admins manage homepage faqs"
  ON public.events_homepage_faqs FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO storage.buckets (id, name, public)
VALUES ('events-homepage', 'events-homepage', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can read events-homepage"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'events-homepage');

CREATE POLICY "Admins can upload events-homepage"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'events-homepage' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update events-homepage"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'events-homepage' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete events-homepage"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'events-homepage' AND has_role(auth.uid(), 'admin'::app_role));