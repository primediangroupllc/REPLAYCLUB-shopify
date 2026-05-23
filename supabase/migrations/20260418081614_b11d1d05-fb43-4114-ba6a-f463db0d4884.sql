CREATE TABLE public.event_notify_signups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  notified_at timestamp with time zone
);

CREATE UNIQUE INDEX idx_event_notify_signups_unique ON public.event_notify_signups(event_id, lower(email));
CREATE INDEX idx_event_notify_signups_event ON public.event_notify_signups(event_id);

ALTER TABLE public.event_notify_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can sign up for notifications"
  ON public.event_notify_signups
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can read all signups"
  ON public.event_notify_signups
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update signups"
  ON public.event_notify_signups
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete signups"
  ON public.event_notify_signups
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages notify signups"
  ON public.event_notify_signups
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);