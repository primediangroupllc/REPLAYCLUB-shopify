ALTER TABLE public.backdrops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can view active backdrops" ON public.backdrops;
DROP POLICY IF EXISTS "admins manage backdrops" ON public.backdrops;

CREATE POLICY "public read active backdrops"
  ON public.backdrops FOR SELECT
  USING (is_active = true);

CREATE POLICY "admins all backdrops"
  ON public.backdrops FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));