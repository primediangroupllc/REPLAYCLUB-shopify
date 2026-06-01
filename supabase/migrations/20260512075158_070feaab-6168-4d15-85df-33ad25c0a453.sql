ALTER TABLE public.backdrops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can view active backdrops" ON public.backdrops;
DROP POLICY IF EXISTS "admins manage backdrops" ON public.backdrops;
-- Idempotency: prior migration 20260512074648 creates these same two policies
-- (using is_admin). This migration is its has_role-based correction; drop first
-- so it applies cleanly whether or not 074648 took effect.
DROP POLICY IF EXISTS "public read active backdrops" ON public.backdrops;
DROP POLICY IF EXISTS "admins all backdrops" ON public.backdrops;

CREATE POLICY "public read active backdrops"
  ON public.backdrops FOR SELECT
  USING (is_active = true);

CREATE POLICY "admins all backdrops"
  ON public.backdrops FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));