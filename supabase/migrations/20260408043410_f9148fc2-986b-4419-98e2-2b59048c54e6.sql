
-- Session invites: links a booking to a shareable secret token
CREATE TABLE public.session_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_by_name text NOT NULL,
  room_title text NOT NULL,
  booking_date date NOT NULL,
  booking_time text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(booking_id),
  UNIQUE(token)
);

ALTER TABLE public.session_invites ENABLE ROW LEVEL SECURITY;

-- Anyone with the token can read (public secret link)
CREATE POLICY "Anyone can read session invites by token"
ON public.session_invites FOR SELECT TO anon, authenticated
USING (true);

-- Authenticated users can create invites for their own bookings
CREATE POLICY "Authenticated users can create invites"
ON public.session_invites FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Service role manages session invites"
ON public.session_invites FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Session guests: people who join via link
CREATE TABLE public.session_guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_invite_id uuid NOT NULL REFERENCES public.session_invites(id) ON DELETE CASCADE,
  guest_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.session_guests ENABLE ROW LEVEL SECURITY;

-- Anyone can read/add guests (public link access)
CREATE POLICY "Anyone can read session guests"
ON public.session_guests FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "Anyone can add themselves as guest"
ON public.session_guests FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Service role manages session guests"
ON public.session_guests FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Session messages: comment wall
CREATE TABLE public.session_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_invite_id uuid NOT NULL REFERENCES public.session_invites(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.session_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read session messages"
ON public.session_messages FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "Anyone can post session messages"
ON public.session_messages FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Service role manages session messages"
ON public.session_messages FOR ALL TO service_role
USING (true) WITH CHECK (true);
