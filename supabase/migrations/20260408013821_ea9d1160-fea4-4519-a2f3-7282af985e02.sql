
CREATE TABLE public.roster_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dj_name text NOT NULL,
  email text NOT NULL,
  genre text,
  city text,
  instagram text,
  soundcloud text,
  spotify text,
  mix_link text NOT NULL,
  bio text,
  press_photo_url text,
  logo_url text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

ALTER TABLE public.roster_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage roster submissions"
ON public.roster_submissions FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can insert roster submissions"
ON public.roster_submissions FOR INSERT
TO anon, authenticated
WITH CHECK (true);
