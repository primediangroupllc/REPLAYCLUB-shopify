
CREATE TABLE public.talent (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alias text NOT NULL,
  name text,
  genre text NOT NULL,
  bio text NOT NULL,
  image_url text NOT NULL,
  instagram_url text,
  soundcloud_url text,
  sort_order integer NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.talent ENABLE ROW LEVEL SECURITY;

-- Anyone can read visible talent (public roster)
CREATE POLICY "Anyone can read visible talent"
  ON public.talent FOR SELECT
  TO anon, authenticated
  USING (visible = true);

-- Admins can do everything
CREATE POLICY "Admins can manage talent"
  ON public.talent FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
