-- Notifications table for in-app notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'reminder',
  read boolean NOT NULL DEFAULT false,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "Users can read own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (lower(user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)));

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update own notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (lower(user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)))
WITH CHECK (lower(user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)));

-- Service role can manage all notifications
CREATE POLICY "Service role manages notifications"
ON public.notifications
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Track which bookings have already had reminders sent
CREATE TABLE public.booking_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE UNIQUE,
  reminder_sent_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages reminders"
ON public.booking_reminders
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);