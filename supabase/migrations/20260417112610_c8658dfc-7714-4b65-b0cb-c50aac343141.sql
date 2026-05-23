-- Allow admins to update guest ID verification status from the admin dashboard
CREATE POLICY "Admins can update session guests"
ON public.session_guests
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));