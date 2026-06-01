-- Bootstrap migration: out-of-band RBAC objects.
-- Lovable created public.app_role, public.user_roles, and public.has_role()
-- directly in its SQL editor on the old project (airoizwnopiaawshpksx) and never
-- wrote migrations for them. Every later migration that defines an admin RLS
-- policy calls public.has_role(), starting with 20260329015031. This file
-- recreates them (verbatim from the old DB) so the migration chain applies
-- cleanly on the new project (ynpkkoqzenmctqrmtnxs). Captured 2026-06-01.

CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL
);

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id)
  REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$function$;

-- is_admin(): convenience wrapper over has_role(). is_admin does NOT exist in
-- prod (its only referencing migration, 20260512074648 "admins all backdrops",
-- was stranded/never deployed). Defined here as the canonical has_role('admin')
-- wrapper so that migration applies cleanly and is functionally identical to
-- every other admin policy in the chain.
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.has_role(_user_id, 'admin'::app_role)
$function$;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read roles" ON public.user_roles
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages roles" ON public.user_roles
  AS PERMISSIVE FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- =========================================================================
-- Out-of-band "challenges" feature. Lovable created these 3 tables, the
-- increment_vote_count() trigger function, the on_vote_increment trigger, and
-- 10 of the 11 policies directly in its SQL editor — never via migration.
-- (The 11th policy, "Voters read own votes" on challenge_votes, IS created by
-- migration 20260424070647, so it is intentionally NOT recreated here.)
-- Migrations 20260428051056/051139 REVOKE on increment_vote_count(), so it
-- must exist before them. Captured verbatim from old DB 2026-06-01.
-- =========================================================================

CREATE TABLE public.challenges (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  theme text NOT NULL,
  prize_description text NOT NULL DEFAULT 'Free 1-hour studio session'::text,
  starts_at timestamp with time zone NOT NULL,
  ends_at timestamp with time zone NOT NULL,
  voting_ends_at timestamp with time zone NOT NULL,
  status text NOT NULL DEFAULT 'upcoming'::text,
  winner_entry_id uuid,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.challenge_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL,
  user_id uuid NOT NULL,
  dj_name text NOT NULL,
  audio_url text NOT NULL,
  vote_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.challenge_votes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL,
  entry_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.challenges
  ADD CONSTRAINT challenges_pkey PRIMARY KEY (id);

ALTER TABLE public.challenge_entries
  ADD CONSTRAINT challenge_entries_pkey PRIMARY KEY (id);
ALTER TABLE public.challenge_entries
  ADD CONSTRAINT challenge_entries_challenge_id_fkey FOREIGN KEY (challenge_id)
  REFERENCES public.challenges(id) ON DELETE CASCADE;
ALTER TABLE public.challenge_entries
  ADD CONSTRAINT challenge_entries_challenge_id_user_id_key UNIQUE (challenge_id, user_id);

ALTER TABLE public.challenge_votes
  ADD CONSTRAINT challenge_votes_pkey PRIMARY KEY (id);
ALTER TABLE public.challenge_votes
  ADD CONSTRAINT challenge_votes_challenge_id_fkey FOREIGN KEY (challenge_id)
  REFERENCES public.challenges(id) ON DELETE CASCADE;
ALTER TABLE public.challenge_votes
  ADD CONSTRAINT challenge_votes_entry_id_fkey FOREIGN KEY (entry_id)
  REFERENCES public.challenge_entries(id) ON DELETE CASCADE;
ALTER TABLE public.challenge_votes
  ADD CONSTRAINT challenge_votes_challenge_id_user_id_key UNIQUE (challenge_id, user_id);

CREATE OR REPLACE FUNCTION public.increment_vote_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE challenge_entries SET vote_count = vote_count + 1 WHERE id = NEW.entry_id;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER on_vote_increment
  AFTER INSERT ON public.challenge_votes
  FOR EACH ROW EXECUTE FUNCTION increment_vote_count();

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_votes ENABLE ROW LEVEL SECURITY;

-- challenges
CREATE POLICY "Anyone can read challenges" ON public.challenges
  AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins can manage challenges" ON public.challenges
  AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role manages challenges" ON public.challenges
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

-- challenge_entries
CREATE POLICY "Anyone can read entries" ON public.challenge_entries
  AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Authenticated users can submit entries" ON public.challenge_entries
  AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Admins can manage entries" ON public.challenge_entries
  AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role manages entries" ON public.challenge_entries
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

-- challenge_votes (NOTE: "Voters read own votes" is created by migration 20260424070647)
CREATE POLICY "Authenticated users can vote once per challenge" ON public.challenge_votes
  AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Admins can manage votes" ON public.challenge_votes
  AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role manages votes" ON public.challenge_votes
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
