-- 1. client_intake table
CREATE TABLE public.client_intake (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  status_token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(24), 'hex') UNIQUE,
  purpose text NOT NULL,
  attendee_count integer NOT NULL DEFAULT 1,
  attendee_names text,
  referral_source text,
  agreed_policies boolean NOT NULL DEFAULT false,
  agreed_code_of_conduct boolean NOT NULL DEFAULT false,
  agreed_cancellation boolean NOT NULL DEFAULT false,
  agreed_liability boolean NOT NULL DEFAULT false,
  agreement_ip text,
  agreement_user_agent text,
  agreed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_intake_purpose_len CHECK (length(purpose) BETWEEN 3 AND 1000),
  CONSTRAINT client_intake_attendee_count_chk CHECK (attendee_count BETWEEN 1 AND 20),
  CONSTRAINT client_intake_names_len CHECK (attendee_names IS NULL OR length(attendee_names) <= 1000),
  CONSTRAINT client_intake_referral_len CHECK (referral_source IS NULL OR length(referral_source) <= 500)
);

CREATE UNIQUE INDEX idx_client_intake_booking ON public.client_intake(booking_id);
CREATE INDEX idx_client_intake_token ON public.client_intake(status_token);

ALTER TABLE public.client_intake ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read intake"
  ON public.client_intake FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages intake"
  ON public.client_intake FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 2. booking_blocklist
CREATE TABLE public.booking_blocklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  phone text,
  full_name text,
  reason text,
  internal_note text,
  blocked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blocklist_at_least_one_field CHECK (
    email IS NOT NULL OR phone IS NOT NULL OR full_name IS NOT NULL
  )
);

CREATE INDEX idx_blocklist_email ON public.booking_blocklist(lower(email)) WHERE email IS NOT NULL;
CREATE INDEX idx_blocklist_phone ON public.booking_blocklist(phone) WHERE phone IS NOT NULL;

ALTER TABLE public.booking_blocklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage blocklist"
  ON public.booking_blocklist FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages blocklist"
  ON public.booking_blocklist FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 3. screening_review_log
CREATE TABLE public.screening_review_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  action text NOT NULL,
  actor_id uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT review_log_action_chk CHECK (action IN ('submitted','approved','declined','auto_declined','withdrawn','address_revealed'))
);

CREATE INDEX idx_review_log_booking ON public.screening_review_log(booking_id);
CREATE INDEX idx_review_log_created ON public.screening_review_log(created_at DESC);

ALTER TABLE public.screening_review_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read review log"
  ON public.screening_review_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages review log"
  ON public.screening_review_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 4. bookings columns
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS screening_status text,
  ADD COLUMN IF NOT EXISTS address_revealed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS screening_review_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS decline_reason text;

-- Validation trigger (avoiding non-immutable CHECK)
CREATE OR REPLACE FUNCTION public.validate_screening_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.screening_status IS NOT NULL AND NEW.screening_status NOT IN
     ('pending_review','approved','declined','auto_declined','withdrawn') THEN
    RAISE EXCEPTION 'Invalid screening_status: %', NEW.screening_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_validate_screening ON public.bookings;
CREATE TRIGGER bookings_validate_screening
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.validate_screening_status();

CREATE INDEX IF NOT EXISTS idx_bookings_screening_status
  ON public.bookings(screening_status)
  WHERE screening_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_review_deadline
  ON public.bookings(screening_review_deadline)
  WHERE screening_status = 'pending_review';

-- 5. SECURITY DEFINER helpers
CREATE OR REPLACE FUNCTION public.get_booking_status_by_token(p_token text)
RETURNS TABLE(
  booking_id uuid,
  customer_name text,
  room_title text,
  booking_date date,
  booking_time text,
  screening_status text,
  address_revealed boolean,
  decline_reason text,
  review_deadline timestamptz,
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT b.id, b.customer_name, b.room_title, b.booking_date, b.booking_time,
         b.screening_status, b.address_revealed, b.decline_reason,
         b.screening_review_deadline, b.created_at
  FROM public.client_intake ci
  JOIN public.bookings b ON b.id = ci.booking_id
  WHERE ci.status_token = p_token
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_blocked(p_email text, p_phone text DEFAULT NULL, p_name text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.booking_blocklist
    WHERE (email IS NOT NULL AND p_email IS NOT NULL AND lower(email) = lower(p_email))
       OR (phone IS NOT NULL AND p_phone IS NOT NULL AND phone = p_phone)
       OR (full_name IS NOT NULL AND p_name IS NOT NULL AND lower(full_name) = lower(p_name))
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_booking_status_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_blocked(text, text, text) TO service_role;