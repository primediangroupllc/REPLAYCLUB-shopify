-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Anyone can read session invites by token" ON public.session_invites;

-- Create a security definer function to look up invites by token
CREATE OR REPLACE FUNCTION public.get_session_invite_by_token(invite_token text)
RETURNS SETOF public.session_invites
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.session_invites WHERE token = invite_token LIMIT 1;
$$;

-- Add restrictive SELECT: admins can see all, service role can see all
-- Regular users/anon cannot list invites directly (must use the function)
CREATE POLICY "Admins can read all session invites"
ON public.session_invites
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow anon/authenticated to read ONLY if they know the token
-- We use a narrow policy that checks if the request comes through RPC
-- Since we can't scope by token in RLS, we rely on the security definer function
-- and block direct table SELECT for non-admins
