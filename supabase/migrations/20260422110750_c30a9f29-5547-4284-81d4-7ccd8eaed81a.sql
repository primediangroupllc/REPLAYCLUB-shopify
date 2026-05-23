
-- 1) INFO: Add service-role policy to booking_reminders_2h (RLS enabled but no policies)
CREATE POLICY "Service role manages 2h reminders"
ON public.booking_reminders_2h FOR ALL
TO service_role
USING (true) WITH CHECK (true);

-- 2) WARN: Tighten overly-permissive INSERT policies (WITH CHECK true)
-- equipment_block_events: only allow inserting an event whose block_direction is one of the known values
DROP POLICY IF EXISTS "Anyone can log block events" ON public.equipment_block_events;
CREATE POLICY "Anyone can log block events"
ON public.equipment_block_events FOR INSERT
TO anon, authenticated
WITH CHECK (
  block_direction IN ('service_blocked_by_rental','rental_blocked_by_service')
  AND length(equipment_name) BETWEEN 1 AND 200
  AND length(service) BETWEEN 1 AND 100
);

-- event_notify_signups: validate basic email shape
DROP POLICY IF EXISTS "Anyone can sign up for notifications" ON public.event_notify_signups;
CREATE POLICY "Anyone can sign up for notifications"
ON public.event_notify_signups FOR INSERT
TO anon, authenticated
WITH CHECK (
  email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND notified_at IS NULL
);

-- experiment_assignments: ensure caller writes a sane subject_id (their auth uid when authed) and no pre-set conversion
DROP POLICY IF EXISTS "Anyone inserts assignment" ON public.experiment_assignments;
CREATE POLICY "Anyone inserts assignment"
ON public.experiment_assignments FOR INSERT
TO anon, authenticated
WITH CHECK (
  converted_at IS NULL
  AND conversion_value_cents IS NULL
  AND length(subject_id) BETWEEN 1 AND 200
  AND length(experiment_key) BETWEEN 1 AND 200
  AND (auth.uid() IS NULL OR subject_id = (auth.uid())::text OR subject_id !~ '^[0-9a-f]{8}-')
);

-- failure_reports: cap log sizes to prevent abuse
DROP POLICY IF EXISTS "Anyone can insert failure reports" ON public.failure_reports;
CREATE POLICY "Anyone can insert failure reports"
ON public.failure_reports FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(error_message) BETWEEN 1 AND 5000
  AND length(stage) BETWEEN 1 AND 200
  AND COALESCE(length(console_log), 0) <= 50000
  AND COALESCE(length(network_log), 0) <= 50000
  AND digest_sent = false
);

-- roster_submissions: validate email + required fields
DROP POLICY IF EXISTS "Anyone can insert roster submissions" ON public.roster_submissions;
CREATE POLICY "Anyone can insert roster submissions"
ON public.roster_submissions FOR INSERT
TO anon, authenticated
WITH CHECK (
  email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND length(dj_name) BETWEEN 1 AND 100
  AND length(mix_link) BETWEEN 1 AND 500
  AND status = 'pending'
);

-- session_guests: only allow attaching to an existing session_invite
DROP POLICY IF EXISTS "Anyone can add themselves as guest" ON public.session_guests;
CREATE POLICY "Anyone can add themselves as guest"
ON public.session_guests FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.session_invites si WHERE si.id = session_invite_id)
  AND length(guest_name) BETWEEN 1 AND 100
);

-- session_invites: must be authenticated and must own the source booking
DROP POLICY IF EXISTS "Authenticated users can create invites" ON public.session_invites;
CREATE POLICY "Authenticated users can create invites"
ON public.session_invites FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = booking_id
      AND lower(b.customer_email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  )
);

-- session_messages: must reference an existing invite
DROP POLICY IF EXISTS "Anyone can post session messages" ON public.session_messages;
CREATE POLICY "Anyone can post session messages"
ON public.session_messages FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.session_invites si WHERE si.id = session_invite_id)
  AND length(author_name) BETWEEN 1 AND 100
  AND length(message) BETWEEN 1 AND 2000
);

-- 3) WARN: Public bucket allows listing — drop bucket-wide SELECT policies.
-- Public buckets serve files via the public URL without RLS, so direct file
-- access keeps working. Removing the SELECT policy prevents anonymous LIST.
DROP POLICY IF EXISTS "Anyone can read challenge clips" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read talent images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view event covers" ON storage.objects;
