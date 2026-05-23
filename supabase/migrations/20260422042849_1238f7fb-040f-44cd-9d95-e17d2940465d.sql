
-- Enable pg_stat_statements if not already
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Function to snapshot slow queries
CREATE OR REPLACE FUNCTION public.capture_slow_queries(p_min_mean_ms numeric DEFAULT 500)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_count int;
BEGIN
  WITH inserted AS (
    INSERT INTO public.query_performance_log (
      query_fingerprint, query_sample, calls, mean_exec_ms, max_exec_ms, captured_at
    )
    SELECT
      md5(query) AS query_fingerprint,
      left(query, 500) AS query_sample,
      calls::int,
      round(mean_exec_time::numeric, 2) AS mean_exec_ms,
      round(max_exec_time::numeric, 2) AS max_exec_ms,
      now()
    FROM pg_stat_statements
    WHERE mean_exec_time >= p_min_mean_ms
      AND query NOT ILIKE '%pg_stat_statements%'
      AND query NOT ILIKE '%capture_slow_queries%'
    ORDER BY mean_exec_time DESC
    LIMIT 100
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM inserted;
  RETURN v_count;
END;
$$;

-- Schedule nightly at 05:00 UTC
DO $$
BEGIN
  PERFORM cron.unschedule('capture-slow-queries-nightly');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'capture-slow-queries-nightly',
  '0 5 * * *',
  $$ SELECT public.capture_slow_queries(500); $$
);
