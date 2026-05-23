import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Health probe — meant for uptime monitors (UptimeRobot, BetterStack, etc.).
 * Returns 200 when all critical dependencies respond, 503 when any fail.
 * Each check has its own 3s timeout so a single slow service can't hang the probe.
 */

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

async function checkDb(): Promise<{ ok: boolean; latency_ms: number; error?: string }> {
  const start = Date.now();
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    await withTimeout(
      supabase.from("integrity_snapshots").select("id", { head: true, count: "exact" }).limit(1),
      3000,
      "db",
    );
    return { ok: true, latency_ms: Date.now() - start };
  } catch (e) {
    return { ok: false, latency_ms: Date.now() - start, error: (e as Error).message };
  }
}

async function checkStripe(): Promise<{ ok: boolean; latency_ms: number; error?: string }> {
  const start = Date.now();
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) return { ok: false, latency_ms: 0, error: "STRIPE_SECRET_KEY missing" };
  try {
    const res = await withTimeout(
      fetch("https://api.stripe.com/v1/balance", {
        headers: { Authorization: `Bearer ${key}` },
      }),
      3000,
      "stripe",
    );
    if (!res.ok) return { ok: false, latency_ms: Date.now() - start, error: `HTTP ${res.status}` };
    return { ok: true, latency_ms: Date.now() - start };
  } catch (e) {
    return { ok: false, latency_ms: Date.now() - start, error: (e as Error).message };
  }
}

async function checkTwilio(): Promise<{ ok: boolean; latency_ms: number; error?: string; configured: boolean }> {
  const start = Date.now();
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!sid || !token) return { ok: true, latency_ms: 0, configured: false };
  try {
    const res = await withTimeout(
      fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, {
        headers: { Authorization: "Basic " + btoa(`${sid}:${token}`) },
      }),
      3000,
      "twilio",
    );
    if (!res.ok) return { ok: false, latency_ms: Date.now() - start, configured: true, error: `HTTP ${res.status}` };
    return { ok: true, latency_ms: Date.now() - start, configured: true };
  } catch (e) {
    return { ok: false, latency_ms: Date.now() - start, configured: true, error: (e as Error).message };
  }
}

function checkEmailQueue(): { ok: boolean; configured: boolean } {
  // Lovable Email runs through pgmq + cron — there's no external API to ping.
  // We assume "ok" since the DB check covers Postgres availability.
  return { ok: true, configured: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const [db, stripe, twilio] = await Promise.all([
    checkDb(),
    checkStripe(),
    checkTwilio(),
  ]);
  const email = checkEmailQueue();

  const allOk = db.ok && stripe.ok && twilio.ok && email.ok;

  return new Response(
    JSON.stringify({
      status: allOk ? "ok" : "degraded",
      checked_at: new Date().toISOString(),
      checks: { db, stripe, twilio, email },
    }),
    {
      status: allOk ? 200 : 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});