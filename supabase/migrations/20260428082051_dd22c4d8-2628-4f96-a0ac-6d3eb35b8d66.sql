-- ID Retention Policy: schema + seeds
-- Adds configurable retention settings and allows system-actor audit entries.

-- 1) Site settings: retention configuration
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS id_retention_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS id_retention_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS id_retention_disclosure_version text NOT NULL DEFAULT 'v1-2026-04-28';

COMMENT ON COLUMN public.site_settings.id_retention_days IS
  'Days after booking_date before ID images are deleted from id-verifications bucket. TODO(retention): swap anchor to bookings.session_end_time when that column is added.';
COMMENT ON COLUMN public.site_settings.id_retention_enabled IS
  'Master switch for the cleanup-id-images cron. Set false to pause deletions.';
COMMENT ON COLUMN public.site_settings.id_retention_disclosure_version IS
  'Version string for the consent/disclosure copy shown at upload time. Bump when copy changes; recorded on every new id_verifications row.';

-- 2) id_verifications: track which disclosure version the user accepted at upload
ALTER TABLE public.id_verifications
  ADD COLUMN IF NOT EXISTS retention_disclosure_version text,
  ADD COLUMN IF NOT EXISTS consent_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_reason text;

COMMENT ON COLUMN public.id_verifications.retention_disclosure_version IS
  'Version of the retention/consent disclosure shown to the user when they uploaded this ID.';
COMMENT ON COLUMN public.id_verifications.deleted_at IS
  'Set by cleanup-id-images cron when the underlying storage object is removed.';

CREATE INDEX IF NOT EXISTS idx_id_verifications_deleted_at
  ON public.id_verifications (deleted_at)
  WHERE deleted_at IS NULL;

-- 3) audit_log: allow system-actor (NULL) inserts for cron jobs
ALTER TABLE public.audit_log
  ALTER COLUMN admin_user_id DROP NOT NULL;

COMMENT ON COLUMN public.audit_log.admin_user_id IS
  'Admin who performed the action. NULL = system actor (cron job, edge function under service_role). Follow-up: consolidate audit_log + admin_audit_log into a single table.';

-- 4) Helper: list IDs eligible for deletion (anchored on bookings.booking_date)
-- TODO(retention): when bookings.session_end_time is introduced, swap the
-- date arithmetic below to use that timestamp instead of booking_date.
CREATE OR REPLACE FUNCTION public.list_expired_id_verifications(p_retention_days integer DEFAULT 30)
RETURNS TABLE (
  verification_id uuid,
  booking_id uuid,
  storage_path text,
  booking_date date,
  uploaded_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    iv.id          AS verification_id,
    iv.booking_id,
    iv.id_image_path AS storage_path,
    b.booking_date,
    iv.created_at  AS uploaded_at
  FROM public.id_verifications iv
  JOIN public.bookings b ON b.id = iv.booking_id
  WHERE iv.deleted_at IS NULL
    AND iv.id_image_path IS NOT NULL
    AND b.booking_date < (CURRENT_DATE - (p_retention_days || ' days')::interval);
$$;

-- 5) Helper: mark a verification row as deleted (called by edge function after storage removal)
CREATE OR REPLACE FUNCTION public.mark_id_verification_deleted(
  p_verification_id uuid,
  p_reason text DEFAULT 'retention_expired'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.id_verifications
  SET deleted_at = now(),
      deletion_reason = p_reason,
      id_image_path = NULL
  WHERE id = p_verification_id
    AND deleted_at IS NULL;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.list_expired_id_verifications(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_id_verification_deleted(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_expired_id_verifications(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_id_verification_deleted(uuid, text) TO service_role;
