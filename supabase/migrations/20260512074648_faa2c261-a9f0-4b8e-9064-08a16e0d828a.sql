-- Fix: backdrops SELECT policy fails for anonymous users with
-- "permission denied for function has_role" because is_admin(auth.uid())
-- → has_role(...) requires permissions anon doesn't have. The OR clause
-- (is_active = true OR is_admin(...)) doesn't short-circuit reliably in
-- PostgreSQL — both sides are evaluated, so the whole policy errors.
--
-- Split into two policies: a public read path for active rows that never
-- touches is_admin, plus a separate admin-everything policy. PostgreSQL
-- OR's matching policies at evaluation time, so admins still get full
-- access including inactive rows.

ALTER TABLE public.backdrops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can view active backdrops" ON public.backdrops;
DROP POLICY IF EXISTS "admins manage backdrops" ON public.backdrops;

CREATE POLICY "public read active backdrops"
  ON public.backdrops FOR SELECT
  USING (is_active = true);

CREATE POLICY "admins all backdrops"
  ON public.backdrops FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
