-- Stage B pt2 — schedule the recognition result poller (poll-mix-recognition).
--
-- HELD: do NOT apply/deploy until approved AND the poll-mix-recognition edge
-- function is deployed. Safe-by-design even if applied early — the poller is
-- gated on acrCloudConfigured() and returns a clean no-op when the ACRCloud
-- secrets are absent, so an unconfigured schedule just pings a function that does
-- nothing. Reuses the SAME Vault secrets the existing reminder crons already use
-- (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) — both already present in prod, no new
-- Vault setup. The poller's service-only guard requires exactly this key.
--
-- Mirrors the house pattern (migration 20260418115102, process-2h-reminders).

-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any prior schedule with the same name to keep this idempotent
DO $$
DECLARE
  v_jobid BIGINT;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'poll-mix-recognition';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END $$;

-- Schedule every minute (File Scanning is async; this picks results up promptly).
-- Tunable: '*/2 * * * *' or '*/5 * * * *' to trade latency for fewer invocations.
SELECT cron.schedule(
  'poll-mix-recognition',
  '* * * * *',
  $cmd$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1) || '/functions/v1/poll-mix-recognition',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $cmd$
);
