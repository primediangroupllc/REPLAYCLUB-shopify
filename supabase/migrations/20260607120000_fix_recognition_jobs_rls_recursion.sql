-- Fix: infinite RLS recursion on public.mix_recognition_jobs.
--
-- Bug (introduced 2026-06-06 in 20260606170000_track_recognition_engine.sql, the
-- "Owners start first recognition job" INSERT policy): the cost-guardrail check
-- used a self-referencing subquery —
--     NOT EXISTS (SELECT 1 FROM public.mix_recognition_jobs j WHERE j.mix_id = mix_id)
-- A policy on mix_recognition_jobs that reads mix_recognition_jobs re-triggers that
-- table's RLS while evaluating it, so Postgres raises
--     "infinite recursion detected in policy for relation mix_recognition_jobs".
-- Because INSERT policies are OR-combined, the broken expression is evaluated for
-- EVERY authenticated insert, so it breaks BOTH owner and admin job creation.
-- (service_role bypasses RLS, so the server path was unaffected — which is why a
-- synthetic RLS verification on 2026-06-07, not the stubbed UI, surfaced it.)
--
-- Fix (same pattern as public.has_role): move the self-check into a SECURITY
-- DEFINER helper that runs as the table owner and therefore bypasses RLS on the
-- inner read, breaking the recursion. The one-scan-per-mix user guardrail is
-- preserved exactly; admin ("Admins manage recognition jobs") and service_role
-- behaviour are untouched.

-- 1. SECURITY DEFINER existence check (bypasses RLS -> no recursion) ----------
CREATE OR REPLACE FUNCTION public.mix_has_any_recognition_job(_mix_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mix_recognition_jobs WHERE mix_id = _mix_id
  )
$$;

-- 2. Recreate the owner INSERT guardrail using the helper --------------------
-- Identical to the original EXCEPT the final self-referencing NOT EXISTS is
-- replaced with NOT public.mix_has_any_recognition_job(mix_id).
DROP POLICY IF EXISTS "Owners start first recognition job" ON public.mix_recognition_jobs;
CREATE POLICY "Owners start first recognition job"
  ON public.mix_recognition_jobs FOR INSERT TO authenticated
  WITH CHECK (
    requested_by_role = 'user'
    AND requested_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.mixes m WHERE m.id = mix_id AND m.user_id = auth.uid())
    AND NOT public.mix_has_any_recognition_job(mix_id)
  );
