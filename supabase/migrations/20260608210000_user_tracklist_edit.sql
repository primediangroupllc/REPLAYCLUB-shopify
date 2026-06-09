-- Let owners edit their mix tracklist while it's still pre-finalized.
--
-- FOLLOWUP-FIXES.md #2 (scope 1a — latent DB/save fix only; NO new user-facing UI
-- wired in here; confirmed_tracklist remains the canonical Stage-B path).
-- Previously enforce_mix_write_rules reverted NEW.tracklist := OLD.tracklist for
-- EVERY non-privileged update, so a user's tracklist edit silently no-op'd. Now a
-- user-owned tracklist edit is ALLOWED while the mix is pre-finalized
-- (status in uploaded / pending_review / processing / needs_tracklist_review) and
-- is still reverted once finalized (report_ready / approved / rejected / failed).
-- Admin + service_role bypass unchanged. Fix #1 (expires_at := NULL on user
-- inserts) preserved verbatim.
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
    NEW.expires_at          := NULL;   -- self-uploaded mixes are permanent (FOLLOWUP-FIXES #1)
    RETURN NEW;
  END IF;

  -- UPDATE by a regular user: revert everything except title / description /
  -- user_notes (and tracklist, which is handled conditionally below).
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
  NEW.duration_seconds    := OLD.duration_seconds;
  NEW.recorded_at         := OLD.recorded_at;
  NEW.expires_at          := OLD.expires_at;
  NEW.reminder_sent       := OLD.reminder_sent;
  NEW.created_at          := OLD.created_at;

  -- tracklist: the OWNER may edit it ONLY while the mix is pre-finalized;
  -- once report_ready / approved / rejected / failed it is locked (reverted).
  IF OLD.status NOT IN ('uploaded','pending_review','processing','needs_tracklist_review') THEN
    NEW.tracklist := OLD.tracklist;
  END IF;

  RETURN NEW;
END;
$$;
