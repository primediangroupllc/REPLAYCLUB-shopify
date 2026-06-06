-- User self-upload flow for DJ mixes / Mix Analyze Report Cards.
--
-- Reuses the EXISTING public.mixes table. Locked decisions (with Brian, 2026-06-06):
--   * user_id stays the OWNER; file_url stays the storage PATH. We do NOT add
--     owner_user_id / audio_file_url / storage_path (they'd duplicate existing
--     columns that every RLS policy, the storage path convention, analyze-mix,
--     and the report-card display already key off).
--   * Add only: status, uploaded_by_user_id, uploaded_by_role, admin_notes,
--     user_notes, updated_at.
--   * AI analysis stays MANUAL for now; the status set is the seam for a later
--     auto-analysis pipeline (uploaded -> processing -> needs_tracklist_review
--     -> report_ready -> approved/rejected/failed).
--   * User uploads keep the standard 7-day expires_at default (unchanged here).
--
-- The admin upload flow (admin inserts a mix for any user) is preserved: admins
-- keep the existing "Admins can manage mixes" ALL policy and the trigger below
-- treats admins + service_role as privileged (no restrictions).

-- 1. Columns ---------------------------------------------------------------
-- ADD with a backfill-friendly default, THEN switch the going-forward default.
-- Existing rows are admin-created and live, so they backfill to 'approved' /
-- 'admin'; new rows default to the safe 'pending_review' / 'admin' (the user
-- self-upload path sets 'user' explicitly and is pinned by the trigger).

ALTER TABLE public.mixes
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS uploaded_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS uploaded_by_role text NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS user_notes text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Make existing rows' updated_at meaningful (match created_at, not migration time).
UPDATE public.mixes SET updated_at = created_at WHERE updated_at <> created_at;

-- Going-forward default: a row created without an explicit status is pending review.
ALTER TABLE public.mixes ALTER COLUMN status SET DEFAULT 'pending_review';

-- 2. Constraints -----------------------------------------------------------
ALTER TABLE public.mixes DROP CONSTRAINT IF EXISTS mixes_status_check;
ALTER TABLE public.mixes
  ADD CONSTRAINT mixes_status_check CHECK (status IN (
    'uploaded',
    'pending_review',
    'processing',
    'needs_tracklist_review',
    'report_ready',
    'approved',
    'rejected',
    'failed'
  ));

ALTER TABLE public.mixes DROP CONSTRAINT IF EXISTS mixes_uploaded_by_role_check;
ALTER TABLE public.mixes
  ADD CONSTRAINT mixes_uploaded_by_role_check CHECK (uploaded_by_role IN ('user','admin'));

-- Admin review queues filter by status.
CREATE INDEX IF NOT EXISTS idx_mixes_status ON public.mixes(status);

-- 3. updated_at maintenance -------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_mix_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_mixes_updated_at ON public.mixes;
CREATE TRIGGER set_mixes_updated_at
  BEFORE UPDATE ON public.mixes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_mix_updated_at();

-- 4. Write-rule enforcement (column-level security) -------------------------
-- RLS gates WHICH ROWS an actor may touch; it cannot gate WHICH COLUMNS. A
-- column GRANT is no good either: admins share the `authenticated` role, so a
-- column-restricted grant would also handcuff admins. So we use a trigger (same
-- house pattern as lock_dob_after_verification).
--
-- service_role (edge functions) and admins are privileged -> no restrictions.
-- A regular user:
--   * on INSERT: provenance + lifecycle are pinned to safe values (own id,
--     role 'user', status 'pending_review'); they cannot seed mix_analysis or
--     admin_notes.
--   * on UPDATE: only title / description / user_notes may change. Any change
--     to a protected column is SILENTLY REVERTED (not raised) — this preserves
--     the app's existing best-effort client writes (waveform_data cache in
--     Profile.tsx, tracklist save) as no-ops instead of turning them into
--     errors, while making status/ownership escalation impossible.
CREATE OR REPLACE FUNCTION public.enforce_mix_write_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role'
     OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.uploaded_by_user_id := auth.uid();
    NEW.uploaded_by_role    := 'user';
    NEW.status              := 'pending_review';
    NEW.mix_analysis        := NULL;   -- report card is AI/admin-produced only
    NEW.admin_notes         := NULL;   -- admin-only field
    RETURN NEW;
  END IF;

  -- UPDATE by a regular user: revert everything except the three editable fields.
  NEW.id                  := OLD.id;
  NEW.user_id             := OLD.user_id;
  NEW.uploaded_by_user_id := OLD.uploaded_by_user_id;
  NEW.uploaded_by_role    := OLD.uploaded_by_role;
  NEW.status              := OLD.status;
  NEW.admin_notes         := OLD.admin_notes;
  NEW.mix_analysis        := OLD.mix_analysis;
  NEW.file_url            := OLD.file_url;
  NEW.streaming_url       := OLD.streaming_url;
  NEW.cover_art_url       := OLD.cover_art_url;
  NEW.waveform_data       := OLD.waveform_data;
  NEW.tracklist           := OLD.tracklist;
  NEW.duration_seconds    := OLD.duration_seconds;
  NEW.recorded_at         := OLD.recorded_at;
  NEW.expires_at          := OLD.expires_at;
  NEW.reminder_sent       := OLD.reminder_sent;
  NEW.created_at          := OLD.created_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_mix_write_rules ON public.mixes;
CREATE TRIGGER enforce_mix_write_rules
  BEFORE INSERT OR UPDATE ON public.mixes
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_mix_write_rules();

-- 5. RLS: let users create + lightly edit their OWN mixes -------------------
-- Existing policies are kept as-is: "Users can read own mixes" (SELECT),
-- "Admins can manage mixes" (ALL), "Service role manages mixes" (ALL).

DROP POLICY IF EXISTS "Users can upload own mixes" ON public.mixes;
CREATE POLICY "Users can upload own mixes"
  ON public.mixes FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND uploaded_by_role = 'user'
    AND status = 'pending_review'
  );

-- Limited edits on own, not-yet-finalized mixes. The trigger above restricts the
-- columns that actually change; this policy restricts the rows.
DROP POLICY IF EXISTS "Users can update own pending mixes" ON public.mixes;
CREATE POLICY "Users can update own pending mixes"
  ON public.mixes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status NOT IN ('approved','rejected'))
  WITH CHECK (auth.uid() = user_id);

-- 6. Storage: let users upload audio into their OWN folder ------------------
-- Path convention is {user_id}/<file>, matching the existing per-user READ
-- policy. The existing "Admins can upload mixes" INSERT policy is untouched.
DROP POLICY IF EXISTS "Users can upload own mixes to storage" ON storage.objects;
CREATE POLICY "Users can upload own mixes to storage"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'mixes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 7. Bucket MIME allowlist: add AIFF + M4A variants ------------------------
-- Required formats are mp3/wav/aiff/m4a. AIFF (audio/aiff, audio/x-aiff) and
-- some M4A reports (audio/x-m4a, audio/m4a) were NOT on the allowlist, so those
-- uploads would 403 at the storage layer. Add them; keep everything already there.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/mp4','audio/aac',
  'audio/ogg','audio/flac','audio/x-flac',
  'audio/aiff','audio/x-aiff','audio/aif','audio/m4a','audio/x-m4a'
]
WHERE id = 'mixes';
