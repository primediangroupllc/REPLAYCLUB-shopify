-- User reminder preferences (keyed by email so it works for guest bookings too)
CREATE TABLE public.reminder_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL UNIQUE,
  user_id UUID,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  sms_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reminder_prefs_email ON public.reminder_preferences (lower(user_email));

ALTER TABLE public.reminder_preferences ENABLE ROW LEVEL SECURITY;

-- Users can see/edit their own prefs (matched by their auth email)
CREATE POLICY "Users view own reminder prefs"
ON public.reminder_preferences
FOR SELECT
TO authenticated
USING (
  lower(user_email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
);

CREATE POLICY "Users insert own reminder prefs"
ON public.reminder_preferences
FOR INSERT
TO authenticated
WITH CHECK (
  lower(user_email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
);

CREATE POLICY "Users update own reminder prefs"
ON public.reminder_preferences
FOR UPDATE
TO authenticated
USING (
  lower(user_email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
);

-- Admins can view all
CREATE POLICY "Admins view all reminder prefs"
ON public.reminder_preferences
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE TRIGGER trg_reminder_prefs_updated_at
BEFORE UPDATE ON public.reminder_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Track 2h reminders separately so we don't double-send
CREATE TABLE public.booking_reminders_2h (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  reminder_sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_reminders_2h ENABLE ROW LEVEL SECURITY;

-- No public access; service role bypasses RLS