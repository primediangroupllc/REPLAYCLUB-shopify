-- Self-uploaded mixes are permanent — they must not expire.
--
-- Self-uploaded report-card mixes are part of a DJ's career/identity timeline
-- (decision locked 2026-06-07, mix-analysis/FOLLOWUP-FIXES.md #1), so they should
-- never carry the 7-day expiry that admin/session-delivery mixes use. Two parts:
--   (1) future user uploads land with expires_at = NULL
--   (2) backfill existing uploaded_by_role='user' rows to expires_at = NULL
-- Admin-uploaded / session-delivery mixes (uploaded_by_role='admin') are untouched
-- and keep their existing expiry + reminder behavior.

-- (1) Future user uploads get NO expiry. enforce_mix_write_rules already pins the
--     user-INSERT provenance; recreate it verbatim from 20260606120000 + one line
--     (NEW.expires_at := NULL) in the INSERT branch. SECURITY DEFINER + search_path
--     preserved. Admin/service inserts hit the early RETURN NEW and are unaffected.
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
    NEW.expires_at          := NULL;   -- [+] self-uploaded mixes are permanent (FOLLOWUP-FIXES #1)
    RETURN NEW;
  END IF;

  -- UPDATE by a regular user: revert everything except title / description / user_notes.
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

-- (2) Backfill existing self-uploads to no-expiry. The trigger above REVERTS
--     expires_at for non-privileged contexts, and a raw migration has no
--     service_role/admin JWT — so disable the trigger around the backfill, or the
--     UPDATE is silently reverted.
ALTER TABLE public.mixes DISABLE TRIGGER enforce_mix_write_rules;
UPDATE public.mixes
  SET expires_at = NULL
  WHERE uploaded_by_role = 'user' AND expires_at IS NOT NULL;
ALTER TABLE public.mixes ENABLE TRIGGER enforce_mix_write_rules;
