
CREATE TABLE public.waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL,
  room_title text NOT NULL,
  booking_date date NOT NULL,
  booking_time text NOT NULL,
  notified boolean NOT NULL DEFAULT false,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_email, room_title, booking_date, booking_time)
);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Users can see their own waitlist entries
CREATE POLICY "Users can read own waitlist entries"
  ON public.waitlist FOR SELECT TO authenticated
  USING (lower(user_email) = lower(COALESCE(auth.jwt() ->> 'email', '')));

-- Users can insert their own waitlist entries
CREATE POLICY "Users can join waitlist"
  ON public.waitlist FOR INSERT TO authenticated
  WITH CHECK (lower(user_email) = lower(COALESCE(auth.jwt() ->> 'email', '')));

-- Users can delete their own waitlist entries
CREATE POLICY "Users can leave waitlist"
  ON public.waitlist FOR DELETE TO authenticated
  USING (lower(user_email) = lower(COALESCE(auth.jwt() ->> 'email', '')));

-- Service role full access
CREATE POLICY "Service role manages waitlist"
  ON public.waitlist FOR ALL TO service_role
  USING (true) WITH CHECK (true);
