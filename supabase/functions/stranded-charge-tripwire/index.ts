import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveAdminEmails } from "../_shared/site-settings.ts";

// Stranded-charge tripwire — daily, READ-ONLY, alert-only.
//
// Covers the open 23505 duplicate-slot defect (see stripe-webhook/index.ts ~L209):
// when two checkouts race the same slot, the 2nd webhook's UPDATE to
// payment_status='paid' hits bookings_unique_paid_slot_idx; the handler then
// calls refundDuplicateSlotLoser(). If that refund does not complete, the
// customer is charged but the booking stays 'pending' — a stranded charge.
//
// Charges are NOT mirrored in Postgres, so we reconcile candidate pending
// bookings against the Stripe API. We NEVER refund or mutate bookings here — we
// record the finding in ops_alerts and email an admin. A human resolves it.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Live key first, then test, so the reconciler works against whichever mode
// created the session (mirrors the dual-secret approach in stripe-webhook). The
// first client that can retrieve a given session wins.
const stripeClients = [
  Deno.env.get("STRIPE_SECRET_KEY") || "",
  Deno.env.get("STRIPE_SECRET_KEY_TEST") || "",
]
  .filter(Boolean)
  .map((k) => new Stripe(k, { apiVersion: "2025-08-27.basil" }));

const SETTLE_MS = 60 * 60 * 1000; // ignore bookings < 1h old (normal webhook window)
const LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000; // bound the scan to the last 14 days
const CANDIDATE_LIMIT = 500; // max pending bookings reconciled per run
const FALLBACK_ADMIN_EMAIL = "replayclubrecords@gmail.com"; // only if site settings has none

async function retrieveSession(id: string): Promise<Stripe.Checkout.Session | null> {
  let lastErr: unknown = null;
  for (const client of stripeClients) {
    try {
      return await client.checkout.sessions.retrieve(id);
    } catch (err) {
      lastErr = err; // wrong mode / not found for this key — try the next
    }
  }
  if (lastErr) console.warn(`retrieve ${id} failed:`, (lastErr as Error).message);
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Service-only guard: cron passes the service-role key as the bearer (from Vault).
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!serviceKey || token !== serviceKey) {
    return json({ error: "forbidden" }, 403);
  }

  if (stripeClients.length === 0) {
    return json({ skipped: true, reason: "no STRIPE_SECRET_KEY configured" });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
  const now = Date.now();

  // Candidate pending bookings that *might* carry a real charge.
  const { data: candidates, error } = await supabase
    .from("bookings")
    .select(
      "id, stripe_session_id, customer_email, amount_cents, room_title, booking_date, booking_time, payment_status, created_at",
    )
    .eq("payment_status", "pending")
    .not("stripe_session_id", "is", null)
    .lt("created_at", new Date(now - SETTLE_MS).toISOString())
    .gt("created_at", new Date(now - LOOKBACK_MS).toISOString())
    .order("created_at", { ascending: false })
    .limit(CANDIDATE_LIMIT);

  if (error) return json({ error: error.message }, 500);

  const scanned = candidates?.length ?? 0;
  // Never let a hit cap look like "all clear" — surface truncation loudly.
  const truncated = scanned >= CANDIDATE_LIMIT;
  if (truncated) {
    console.warn(
      `candidate cap hit: ${CANDIDATE_LIMIT} pending-with-session bookings (last 14d) ` +
        `were scanned this run; older/excess candidates were NOT checked. ` +
        `Narrow the window or raise CANDIDATE_LIMIT if this persists.`,
    );
  }

  const stranded: Array<Record<string, unknown>> = [];
  for (const b of candidates ?? []) {
    const session = await retrieveSession(b.stripe_session_id as string);
    if (!session) continue; // couldn't verify — skip rather than false-alert
    if (session.payment_status !== "paid") continue; // unpaid/open/expired = abandoned

    // Best-effort correlation with the webhook log to show what went wrong.
    const { data: evts } = await supabase
      .from("webhook_events")
      .select("event_type, status, error_message, attempts, created_at")
      .eq("payload->data->object->>id", b.stripe_session_id)
      .order("created_at", { ascending: false })
      .limit(5);

    stranded.push({
      booking_id: b.id,
      stripe_session_id: b.stripe_session_id,
      payment_intent:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null,
      customer_email: b.customer_email,
      amount_cents: b.amount_cents,
      currency: session.currency,
      slot: `${b.room_title} ${b.booking_date} ${b.booking_time}`,
      booking_age_hours: Math.round((now - new Date(b.created_at).getTime()) / 3.6e6),
      stripe_payment_status: session.payment_status,
      webhook_events: evts ?? [],
    });
  }

  // Record findings; dedupe by session so the same charge isn't re-alerted daily.
  let newAlerts: Array<Record<string, unknown>> = [];
  if (stranded.length > 0) {
    const rows = stranded.map((s) => ({
      kind: "stranded_charge",
      severity: "critical",
      dedupe_key: `stranded_charge:${s.stripe_session_id}`,
      summary:
        `Stranded charge: ${((s.amount_cents as number) / 100).toFixed(2)} ` +
        `${String(s.currency ?? "usd").toUpperCase()} paid, booking ${s.booking_id} ` +
        `still pending (${s.slot})`,
      details: s,
    }));
    const { data: inserted, error: upErr } = await supabase
      .from("ops_alerts")
      .upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true })
      .select();
    if (upErr) console.error("ops_alerts upsert failed:", upErr.message);
    newAlerts = inserted ?? [];
  }

  // Alert an admin ONLY for newly-detected stranded charges. Read-only: a human
  // decides on refunds; this tool never touches Stripe or bookings.
  if (newAlerts.length > 0) {
    const lines = newAlerts
      .map((a) => {
        const d = (a.details ?? {}) as Record<string, unknown>;
        return `- ${a.summary}\n    session=${d.stripe_session_id} intent=${d.payment_intent} email=${d.customer_email}`;
      })
      .join("\n");
    const consoleLog =
      `${newAlerts.length} NEW stranded charge(s) — Stripe shows paid but the booking is still pending.\n` +
      `Likely the 23505 duplicate-slot path where the refund did not complete.\n\n` +
      `${lines}\n\nResolve in Stripe + bookings manually; this tool never auto-refunds.`;
    const idBase =
      "stranded-charge-" +
      newAlerts
        .map((a) => ((a.details ?? {}) as Record<string, unknown>).stripe_session_id)
        .sort()
        .join("_")
        .slice(0, 80);
    // Follow the configured admin recipient list (falls back to the literal only
    // if site settings has none) — mirrors the admin-alert loop in stripe-webhook.
    const adminEmails = await resolveAdminEmails(FALLBACK_ADMIN_EMAIL);
    for (const adminEmail of adminEmails) {
      try {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "booking-failure-admin",
            recipientEmail: adminEmail,
            idempotencyKey: `${idBase}-${adminEmail}`,
            templateData: {
              stage: `stranded-charge-tripwire (${newAlerts.length})`,
              errorMessage: `${newAlerts.length} stranded Stripe charge(s) detected — paid but booking pending.`,
              occurredAt: new Date().toISOString(),
              consoleLog,
              networkLog: "",
            },
          },
        });
      } catch (e) {
        console.error(`admin email failed (${adminEmail}):`, (e as Error).message);
      }
    }
  }

  return json({
    scanned,
    truncated,
    stranded: stranded.length,
    new_alerts: newAlerts.length,
    stranded_details: stranded,
  });
});
