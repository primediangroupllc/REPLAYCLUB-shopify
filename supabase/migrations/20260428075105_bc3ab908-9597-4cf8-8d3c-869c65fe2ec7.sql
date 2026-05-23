-- =========================================================================
-- Age-Gated ID Verification v2 — Schema + RLS + Storage (foundation only)
-- Admin-only gated. No UI/edge functions in this PR.
-- =========================================================================

-- 1. Extend bookings ------------------------------------------------------
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'not_required'
    CHECK (verification_status IN (
      'not_required',
      'pending_id_upload',
      'pending_ocr',
      'pending_guardian_info',
      'pending_guardian_id',
      'pending_admin_review',
      'approved',
      'rejected',
      'expired'
    )),
  ADD COLUMN IF NOT EXISTS verification_held_until timestamptz,
  ADD COLUMN IF NOT EXISTS user_age_tier text
    CHECK (user_age_tier IN ('adult_21', 'young_adult_18_20', 'minor_under_18'));

CREATE INDEX IF NOT EXISTS idx_bookings_verification_status
  ON public.bookings (verification_status)
  WHERE verification_status NOT IN ('not_required', 'approved', 'rejected', 'expired');

CREATE INDEX IF NOT EXISTS idx_bookings_verification_held_until
  ON public.bookings (verification_held_until)
  WHERE verification_held_until IS NOT NULL;

-- 2. id_verifications -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.id_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,

  id_image_path text NOT NULL,
  id_capture_method text NOT NULL CHECK (id_capture_method IN ('camera', 'upload')),

  ocr_provider text,
  ocr_extracted_dob date,
  ocr_extracted_name text,
  ocr_confidence numeric(3,2),
  ocr_raw_response jsonb,

  detected_age_tier text CHECK (detected_age_tier IN ('adult_21', 'young_adult_18_20', 'minor_under_18')),

  guardian_name text,
  guardian_phone text,
  guardian_email text,
  guardian_id_image_path text,
  guardian_consent_signed_at timestamptz,
  guardian_consent_text_version text,

  review_status text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'auto_approved', 'manually_approved', 'rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  rejection_reason text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_id_verifications_booking ON public.id_verifications(booking_id);
CREATE INDEX IF NOT EXISTS idx_id_verifications_user ON public.id_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_id_verifications_review_status
  ON public.id_verifications(review_status)
  WHERE review_status = 'pending';

CREATE TRIGGER trg_id_verifications_updated_at
  BEFORE UPDATE ON public.id_verifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.id_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own verification"
  ON public.id_verifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "users insert own verification"
  ON public.id_verifications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "admins read all verifications"
  ON public.id_verifications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Lock UPDATE to service_role only (edge functions). Admin reviews go through
-- a SECURITY DEFINER RPC in the next PR.
REVOKE UPDATE ON public.id_verifications FROM authenticated, anon;
GRANT UPDATE ON public.id_verifications TO service_role;

-- 3. guardian_checkins ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.guardian_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id),
  verification_id uuid NOT NULL REFERENCES public.id_verifications(id),
  checked_in_by uuid NOT NULL,
  guardian_id_matched boolean NOT NULL,
  notes text,
  checked_in_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guardian_checkins_booking ON public.guardian_checkins(booking_id);

ALTER TABLE public.guardian_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read guardian checkins"
  ON public.guardian_checkins FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins insert guardian checkins"
  ON public.guardian_checkins FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND checked_in_by = auth.uid());

-- 4. guardian_consent_tokens ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.guardian_consent_tokens (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id),
  verification_id uuid NOT NULL REFERENCES public.id_verifications(id),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guardian_consent_tokens_booking ON public.guardian_consent_tokens(booking_id);
CREATE INDEX IF NOT EXISTS idx_guardian_consent_tokens_active
  ON public.guardian_consent_tokens(expires_at)
  WHERE consumed_at IS NULL;

ALTER TABLE public.guardian_consent_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read consent tokens"
  ON public.guardian_consent_tokens FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Token-based access for guardians (no auth) is exposed via SECURITY DEFINER
-- RPC in the next PR — no anon SELECT policy here.

-- 5. Storage bucket: id-verifications (plural, isolated from legacy) ------
INSERT INTO storage.buckets (id, name, public)
VALUES ('id-verifications', 'id-verifications', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "id-verifications owner read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'id-verifications'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "id-verifications owner insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'id-verifications'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "id-verifications admin read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'id-verifications'
    AND public.has_role(auth.uid(), 'admin')
  );

-- 6. Admin-only feature flag in site_settings -----------------------------
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS verification_v2_admin_only boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS guardian_consent_text_version text,
  ADD COLUMN IF NOT EXISTS guardian_consent_text text;

COMMENT ON COLUMN public.site_settings.verification_v2_admin_only IS
  'When true, the new age-gated verification flow runs only for admin users. Flip to false after lawyer review.';
COMMENT ON COLUMN public.site_settings.guardian_consent_text IS
  'Lawyer-approved consent form body. Guardian flow refuses to render until this is non-NULL.';
COMMENT ON COLUMN public.site_settings.guardian_consent_text_version IS
  'Version label (e.g. v1-2026-05-01) snapshotted into id_verifications.guardian_consent_text_version on signing.';
