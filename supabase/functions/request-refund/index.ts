import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.3";
import Stripe from "https://esm.sh/stripe@17.5.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const AUTO_APPROVE_HOURS = 24;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-11-20.acacia" });

    const auth = req.headers.get("authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);
    const { data: { user } } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    if (!user?.email) return json({ error: "Unauthorized" }, 401);

    const { booking_id, reason } = await req.json();
    if (!booking_id || !reason || typeof reason !== "string" || reason.length < 5) {
      return json({ error: "booking_id and reason (>=5 chars) required" }, 400);
    }

    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .select("id, customer_email, customer_name, payment_status, booking_date, booking_time, amount_cents, stripe_session_id, refund_status")
      .eq("id", booking_id)
      .maybeSingle();
    if (bErr || !booking) return json({ error: "Booking not found" }, 404);
    if (booking.customer_email.toLowerCase() !== user.email.toLowerCase()) return json({ error: "Forbidden" }, 403);
    if (booking.payment_status !== "paid") return json({ error: "Booking not paid" }, 400);
    if (booking.refund_status === "processed" || booking.refund_status === "pending") {
      return json({ error: "Refund already requested" }, 400);
    }

    const sessionStart = new Date(`${booking.booking_date}T${booking.booking_time || "00:00"}`);
    const hoursBefore = (sessionStart.getTime() - Date.now()) / 36e5;
    const autoApprove = hoursBefore >= AUTO_APPROVE_HOURS;

    const { data: refundReq, error: rErr } = await supabase
      .from("refund_requests")
      .insert({
        booking_id: booking.id,
        customer_email: booking.customer_email,
        customer_name: booking.customer_name,
        reason,
        amount_cents: booking.amount_cents,
        status: autoApprove ? "auto_approved" : "pending",
        hours_before_session: hoursBefore,
      })
      .select()
      .single();
    if (rErr) return json({ error: rErr.message }, 500);

    await supabase.from("bookings").update({ refund_status: "pending", cancellation_reason: reason }).eq("id", booking.id);

    if (autoApprove && booking.stripe_session_id) {
      try {
        const session = await stripe.checkout.sessions.retrieve(booking.stripe_session_id);
        const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
        if (pi) {
          // Audit #6 — idempotency guard: check for an existing refund on
          // this PaymentIntent first. Webhook lag + concurrent refund-button
          // clicks used to issue duplicate refunds; this short-circuits if
          // Stripe already has one for this PI.
          const existing = await stripe.refunds.list({ payment_intent: pi, limit: 5 });
          const priorRefund = existing.data.find(
            (r) => r.status === "succeeded" || r.status === "pending",
          );
          if (priorRefund) {
            await supabase.from("refund_requests").update({
              status: "processed",
              stripe_refund_id: priorRefund.id,
              processed_at: new Date().toISOString(),
              admin_notes: "Reused existing Stripe refund.",
            }).eq("id", refundReq.id);
            await supabase.from("bookings").update({
              payment_status: "refunded",
              refund_status: "processed",
              refunded_amount_cents: booking.amount_cents,
            }).eq("id", booking.id);
            return json({
              success: true,
              status: "processed",
              stripe_refund_id: priorRefund.id,
              message: "Refund already issued.",
            });
          }
          const refund = await stripe.refunds.create({ payment_intent: pi, reason: "requested_by_customer" });
          await supabase.from("refund_requests").update({
            status: "processed",
            stripe_refund_id: refund.id,
            processed_at: new Date().toISOString(),
          }).eq("id", refundReq.id);
          await supabase.from("bookings").update({
            payment_status: "refunded",
            refund_status: "processed",
            refunded_amount_cents: booking.amount_cents,
          }).eq("id", booking.id);

          await supabase.from("notifications").insert({
            user_email: booking.customer_email,
            title: "Refund Processed",
            message: `Your refund of $${(booking.amount_cents / 100).toFixed(2)} has been issued.`,
            type: "refund",
            booking_id: booking.id,
          });
        }
      } catch (e) {
        console.error("Stripe refund failed", e);
        await supabase.from("refund_requests").update({ status: "failed", admin_notes: String(e) }).eq("id", refundReq.id);
        return json({ success: true, status: "queued", message: "Refund queued for admin review" });
      }
    } else {
      await supabase.from("notifications").insert({
        user_email: booking.customer_email,
        title: "Refund Request Received",
        message: "Your refund request is under review. We'll respond within 48 hours.",
        type: "refund",
        booking_id: booking.id,
      });
    }

    return json({ success: true, status: autoApprove ? "processed" : "pending", auto_approved: autoApprove });
  } catch (e) {
    console.error(e);
    return json({ error: "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}