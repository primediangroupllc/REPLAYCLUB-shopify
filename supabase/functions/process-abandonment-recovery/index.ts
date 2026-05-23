import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Sends "your slot is available again" emails for abandoned checkouts.
 * Runs hourly via cron OR can be invoked manually by admins.
 *
 * Rules:
 * - Only emails captured ≥10min ago and ≤24h ago (give buyer time to retry,
 *   stop after 24h to avoid being creepy).
 * - Skip emails already sent (recovery_email_sent_at IS NOT NULL).
 * - Skip if a paid booking now exists for that slot.
 * - Skip suppressed emails (bounces / unsubscribes).
 * - Mark as sent immediately so retries don't double-send.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: rows, error } = await supabase
    .from("abandoned_checkouts")
    .select("*")
    .is("recovery_email_sent_at", null)
    .lt("expired_at", tenMinAgo)
    .gt("expired_at", dayAgo)
    .order("expired_at", { ascending: true })
    .limit(50);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!rows || rows.length === 0) {
    return new Response(JSON.stringify({ sent: 0, message: "No abandoned checkouts to recover" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let sentCount = 0;
  let skippedCount = 0;

  for (const row of rows) {
    try {
      const ctx = (row.context || {}) as { room_title?: string; booking_date?: string; booking_time?: string };

      // Skip if a paid booking now exists for this slot
      if (ctx.room_title && ctx.booking_date && ctx.booking_time) {
        const { data: paid } = await supabase
          .from("bookings")
          .select("id")
          .eq("room_title", ctx.room_title)
          .eq("booking_date", ctx.booking_date)
          .eq("booking_time", ctx.booking_time)
          .in("payment_status", ["paid", "promo"])
          .limit(1);
        if (paid && paid.length > 0) {
          await supabase
            .from("abandoned_checkouts")
            .update({ recovery_email_sent_at: new Date().toISOString() })
            .eq("id", row.id);
          skippedCount++;
          continue;
        }
      }

      // Skip if email is suppressed (bounce/complaint/unsubscribe)
      const { data: suppressed } = await supabase
        .from("suppressed_emails")
        .select("id")
        .eq("email", row.email.toLowerCase())
        .limit(1);
      if (suppressed && suppressed.length > 0) {
        await supabase
          .from("abandoned_checkouts")
          .update({ recovery_email_sent_at: new Date().toISOString() })
          .eq("id", row.id);
        skippedCount++;
        continue;
      }

      // Mark as sent BEFORE sending so a partial failure doesn't double-send
      await supabase
        .from("abandoned_checkouts")
        .update({ recovery_email_sent_at: new Date().toISOString() })
        .eq("id", row.id);

      // Reuse the booking-failure-admin template body but flip stage so it's clearly recovery.
      // We piggyback on send-transactional-email which already handles queueing + suppression.
      const dateLabel = ctx.booking_date && ctx.booking_time
        ? `${ctx.booking_date} at ${ctx.booking_time}`
        : "your selected slot";

      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "booking-failure-admin",
          recipientEmail: row.email,
          idempotencyKey: `abandonment-${row.id}`,
          templateData: {
            stage: "Still interested?",
            errorMessage: `Your hold on ${ctx.room_title || "the studio"} for ${dateLabel} just expired. The slot is available again — you can grab it before someone else does.`,
            occurredAt: new Date().toISOString(),
            service: ctx.room_title || row.service,
            bookingDate: ctx.booking_date || "",
            bookingTime: ctx.booking_time || "",
            customerEmail: row.email,
          },
        },
      });
      sentCount++;
    } catch (e) {
      console.error("Failed to send recovery email for", row.id, e);
    }
  }

  return new Response(
    JSON.stringify({ sent: sentCount, skipped: skippedCount, total: rows.length }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});