-- First-party funnel telemetry — append-only event capture for the V1 funnel.
-- Instrumentation ONLY: no dashboard, no analytics UI, no third-party. The client
-- writes via src/lib/analytics.ts (fire-and-forget).
--
-- Append-only by RLS:
--   * anon + authenticated may INSERT, but cannot attribute an event to another
--     user (anon writes user_id = NULL; a signed-in user may only use their own id)
--   * SELECT restricted to admins (telemetry is private)
--   * no UPDATE / DELETE policy → RLS denies both (events are immutable)
-- Nothing here touches existing tables, booking, mixes, or recognition.

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event         text NOT NULL,
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- NULL when logged-out
  anonymous_id  text,                                              -- client localStorage id; stitches pre-auth → auth
  session_id    text,                                              -- per-tab session id
  path          text,                                              -- window.location.pathname at fire time
  props         jsonb NOT NULL DEFAULT '{}'::jsonb,                -- event-specific payload
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_event      ON public.analytics_events(event);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON public.analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user       ON public.analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_anon       ON public.analytics_events(anonymous_id);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- INSERT: anyone may append, but cannot spoof another user's id.
DROP POLICY IF EXISTS "Anyone can append analytics events" ON public.analytics_events;
CREATE POLICY "Anyone can append analytics events"
  ON public.analytics_events FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- SELECT: admins only.
DROP POLICY IF EXISTS "Admins read analytics events" ON public.analytics_events;
CREATE POLICY "Admins read analytics events"
  ON public.analytics_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- (Intentionally no UPDATE/DELETE policies — append-only.)
