import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Synthetic monitor — meant to be invoked by pg_cron daily.
 *
 * Hits the /health endpoint, then logs the result and (on failure) writes a
 * row to failure_reports so the admin failure-digest sweeps it up. Returns a
 * compact JSON summary so cron logs stay scannable.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const startedAt = new Date().toISOString();
  const checks: Record<string, unknown> = {};
  let degraded = false;

  // 1. Hit /health
  try {
    const start = Date.now();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/health`, {
      headers: { Authorization: `Bearer ${ANON_KEY}`, apikey: ANON_KEY },
    });
    const body = await res.json().catch(() => ({}));
    checks.health = { status: res.status, latency_ms: Date.now() - start, body };
    if (res.status !== 200) degraded = true;
  } catch (e) {
    checks.health = { error: String(e) };
    degraded = true;
  }

  // 2. Sanity DB read
  try {
    const start = Date.now();
    const { error } = await supabase
      .from("integrity_snapshots")
      .select("id", { head: true, count: "exact" })
      .limit(1);
    checks.db_read = { ok: !error, latency_ms: Date.now() - start, error: error?.message };
    if (error) degraded = true;
  } catch (e) {
    checks.db_read = { error: String(e) };
    degraded = true;
  }

  // 3. On degraded, log to failure_reports for the digest cron.
  if (degraded) {
    await supabase.from("failure_reports").insert({
      stage: "synthetic_monitor",
      category: "other",
      error_message: "Synthetic monitor detected degraded service",
      route: "/functions/v1/synthetic-monitor",
      user_agent: "synthetic-monitor/1.0",
      console_log: JSON.stringify(checks).slice(0, 4000),
    });
  }

  return new Response(
    JSON.stringify({ ok: !degraded, started_at: startedAt, checks }),
    {
      status: degraded ? 503 : 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});