-- Fix: admin "FOR ALL" policy on public.backdrops was not scoped to a role,
-- so Postgres evaluated it for anonymous requests too. The policy body
-- calls public.has_role(...) which the anon role can't EXECUTE → entire
-- SELECT fails with "permission denied for function has_role".
--
-- Adding `TO authenticated` scopes the admin policy so anon never reaches
-- the has_role call. Anon's public-read path (policy "public read active
-- backdrops") stays untouched.

ALTER TABLE public.backdrops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins all backdrops" ON public.backdrops;

CREATE POLICY "admins all backdrops"
  ON public.backdrops FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
