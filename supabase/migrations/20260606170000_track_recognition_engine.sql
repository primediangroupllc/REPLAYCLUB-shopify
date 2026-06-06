-- Track Recognition Engine — Stage A schema (design: mix-analysis/RECOGNITION-SPEC.md).
--
-- Adds the recognition data model ONLY. No live provider wiring, no secrets, no
-- cron yet (those land in Stage B). Nothing here changes existing mixes / upload /
-- report-card / admin / profile behavior — all four tables are brand new.
--
-- Locked decisions (with Brian, 2026-06-06):
--   * Transport = ACRCloud File Scanning (built later). User OR admin can trigger.
--   * Reviewer is an ABSTRACTION, not hardcoded admin: review_source ∈ (admin,ai,user)
--     so an AI reviewer can take over in V2 with NO schema change (service_role writes).
--   * Cost guardrail: a user may start ONE recognition job per mix. Re-scan = admin.
--     Enforced by requested_by_role + retry_count + the "first job only" INSERT policy.
--   * mixes.tracklist (simple {title,artist}[]) stays the display mirror; detailed
--     recognition lives in these tables.
--   * service_role bypasses RLS (BYPASSRLS) — edge functions do the privileged work,
--     so policies below only cover authenticated owners + admins.

-- House updated_at trigger fn (idempotent; matches the existing PROD definition,
-- INCLUDING `SET search_path TO 'public'` — verified via pg_get_functiondef. Without
-- it, CREATE OR REPLACE would strip that hardening from the shared trigger fn used by
-- updated_at triggers across the whole schema (re-opening the mutable-search_path lint).
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 1. mix_recognition_jobs ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mix_recognition_jobs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mix_id            uuid NOT NULL REFERENCES public.mixes(id) ON DELETE CASCADE,
  requested_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_by_role text NOT NULL DEFAULT 'user'
                      CHECK (requested_by_role IN ('user','admin','service')),
  retry_count       integer NOT NULL DEFAULT 0,
  status            text NOT NULL DEFAULT 'queued'
                      CHECK (status IN ('queued','processing','recognition_complete',
                                        'needs_review','ai_review','confirmed','failed')),
  provider          text NOT NULL DEFAULT 'acrcloud',
  provider_file_id  text,
  provider_summary  jsonb,
  review_source     text CHECK (review_source IN ('admin','ai','user')),
  reviewed_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  review_confidence numeric,
  reviewed_at       timestamptz,
  error_message     text,
  last_polled_at    timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mix_recognition_jobs_mix      ON public.mix_recognition_jobs(mix_id);
CREATE INDEX IF NOT EXISTS idx_mix_recognition_jobs_status   ON public.mix_recognition_jobs(status);
CREATE INDEX IF NOT EXISTS idx_mix_recognition_jobs_provider ON public.mix_recognition_jobs(provider_file_id);

DROP TRIGGER IF EXISTS update_mix_recognition_jobs_updated_at ON public.mix_recognition_jobs;
CREATE TRIGGER update_mix_recognition_jobs_updated_at
  BEFORE UPDATE ON public.mix_recognition_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. recognized_track_segments (raw per-match audit trail; server-written) ---
CREATE TABLE IF NOT EXISTS public.recognized_track_segments (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id                 uuid NOT NULL REFERENCES public.mix_recognition_jobs(id) ON DELETE CASCADE,
  mix_id                 uuid NOT NULL REFERENCES public.mixes(id) ON DELETE CASCADE,
  sample_start_seconds   numeric,
  sample_end_seconds     numeric,
  detected_start_seconds numeric,
  detected_end_seconds   numeric,
  title                  text,
  artist                 text,
  album                  text,
  isrc                   text,
  source                 text CHECK (source IN ('acrcloud','audd','manual','unknown')),
  source_confidence      numeric,
  normalized_confidence  numeric,
  status                 text CHECK (status IN ('confirmed','likely','possible','unknown','user_corrected')),
  platform_ids           jsonb,
  raw_response           jsonb,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recognized_segments_job      ON public.recognized_track_segments(job_id);
CREATE INDEX IF NOT EXISTS idx_recognized_segments_mix      ON public.recognized_track_segments(mix_id);
CREATE INDEX IF NOT EXISTS idx_recognized_segments_mix_time ON public.recognized_track_segments(mix_id, detected_start_seconds);

DROP TRIGGER IF EXISTS update_recognized_segments_updated_at ON public.recognized_track_segments;
CREATE TRIGGER update_recognized_segments_updated_at
  BEFORE UPDATE ON public.recognized_track_segments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. confirmed_tracklist (editable, reviewable, downstream-facing) -----------
CREATE TABLE IF NOT EXISTS public.confirmed_tracklist (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mix_id           uuid NOT NULL REFERENCES public.mixes(id) ON DELETE CASCADE,
  position         integer,
  title            text,
  artist           text,
  start_seconds    numeric,
  end_seconds      numeric,
  bpm              numeric,
  musical_key      text,
  genre            text,
  energy_level     numeric,
  vocal_density    numeric,
  popularity_score numeric,
  source           text CHECK (source IN ('auto','user_edit','admin_edit','manual')),
  confidence       numeric,
  metadata         jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_confirmed_tracklist_mix     ON public.confirmed_tracklist(mix_id);
CREATE INDEX IF NOT EXISTS idx_confirmed_tracklist_mix_pos ON public.confirmed_tracklist(mix_id, position);

DROP TRIGGER IF EXISTS update_confirmed_tracklist_updated_at ON public.confirmed_tracklist;
CREATE TRIGGER update_confirmed_tracklist_updated_at
  BEFORE UPDATE ON public.confirmed_tracklist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. track_metadata_cache (dedupe enrichment across mixes) ------------------
CREATE TABLE IF NOT EXISTS public.track_metadata_cache (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_key text UNIQUE,
  title          text,
  artist         text,
  album          text,
  isrc           text,
  artwork_url    text,
  bpm            numeric,
  musical_key    text,
  genre          text,
  platform_ids   jsonb,
  metadata       jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- RLS ----------------------------------------------------------------------
ALTER TABLE public.mix_recognition_jobs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recognized_track_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.confirmed_tracklist       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.track_metadata_cache      ENABLE ROW LEVEL SECURITY;

-- mix_recognition_jobs:
DROP POLICY IF EXISTS "Admins manage recognition jobs" ON public.mix_recognition_jobs;
CREATE POLICY "Admins manage recognition jobs"
  ON public.mix_recognition_jobs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Owners read own recognition jobs" ON public.mix_recognition_jobs;
CREATE POLICY "Owners read own recognition jobs"
  ON public.mix_recognition_jobs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.mixes m WHERE m.id = mix_id AND m.user_id = auth.uid()));

-- The cost guardrail: an owner may insert exactly the FIRST job for their mix.
DROP POLICY IF EXISTS "Owners start first recognition job" ON public.mix_recognition_jobs;
CREATE POLICY "Owners start first recognition job"
  ON public.mix_recognition_jobs FOR INSERT TO authenticated
  WITH CHECK (
    requested_by_role = 'user'
    AND requested_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.mixes m WHERE m.id = mix_id AND m.user_id = auth.uid())
    AND NOT EXISTS (SELECT 1 FROM public.mix_recognition_jobs j WHERE j.mix_id = mix_id)
  );

-- recognized_track_segments: owners read own; admins all; (writes = service_role).
DROP POLICY IF EXISTS "Admins manage recognized segments" ON public.recognized_track_segments;
CREATE POLICY "Admins manage recognized segments"
  ON public.recognized_track_segments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Owners read own recognized segments" ON public.recognized_track_segments;
CREATE POLICY "Owners read own recognized segments"
  ON public.recognized_track_segments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.mixes m WHERE m.id = mix_id AND m.user_id = auth.uid()));

-- confirmed_tracklist: owners read own; owners edit own WHILE pre-confirm; admins all.
DROP POLICY IF EXISTS "Admins manage confirmed tracklist" ON public.confirmed_tracklist;
CREATE POLICY "Admins manage confirmed tracklist"
  ON public.confirmed_tracklist FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Owners read own confirmed tracklist" ON public.confirmed_tracklist;
CREATE POLICY "Owners read own confirmed tracklist"
  ON public.confirmed_tracklist FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.mixes m WHERE m.id = mix_id AND m.user_id = auth.uid()));

-- "pre-confirm" = no confirmed job exists for the mix yet. Once confirmed, the
-- user can no longer edit (admin/service still can).
DROP POLICY IF EXISTS "Owners edit own tracklist pre-confirm" ON public.confirmed_tracklist;
CREATE POLICY "Owners edit own tracklist pre-confirm"
  ON public.confirmed_tracklist FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.mixes m WHERE m.id = mix_id AND m.user_id = auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM public.mix_recognition_jobs j
      WHERE j.mix_id = mix_id AND j.status = 'confirmed'
    )
  );

DROP POLICY IF EXISTS "Owners update own tracklist pre-confirm" ON public.confirmed_tracklist;
CREATE POLICY "Owners update own tracklist pre-confirm"
  ON public.confirmed_tracklist FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.mixes m WHERE m.id = mix_id AND m.user_id = auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM public.mix_recognition_jobs j
      WHERE j.mix_id = mix_id AND j.status = 'confirmed'
    )
  )
  WITH CHECK (EXISTS (SELECT 1 FROM public.mixes m WHERE m.id = mix_id AND m.user_id = auth.uid()));

DROP POLICY IF EXISTS "Owners delete own tracklist pre-confirm" ON public.confirmed_tracklist;
CREATE POLICY "Owners delete own tracklist pre-confirm"
  ON public.confirmed_tracklist FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.mixes m WHERE m.id = mix_id AND m.user_id = auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM public.mix_recognition_jobs j
      WHERE j.mix_id = mix_id AND j.status = 'confirmed'
    )
  );

-- track_metadata_cache: any authenticated user may read; admins manage.
DROP POLICY IF EXISTS "Admins manage track metadata cache" ON public.track_metadata_cache;
CREATE POLICY "Admins manage track metadata cache"
  ON public.track_metadata_cache FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Authenticated read track metadata cache" ON public.track_metadata_cache;
CREATE POLICY "Authenticated read track metadata cache"
  ON public.track_metadata_cache FOR SELECT TO authenticated
  USING (true);
