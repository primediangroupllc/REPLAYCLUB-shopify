import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.3";
import Stripe from "https://esm.sh/stripe@17.5.0?target=deno";
import {
  sendTwilioSms,
  resolveAdminPhones,
  resolveCancellationCutoffHours,
} from "../_shared/site-settings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { booking_id } = await req.json();
    if (!booking_id || typeof booking_id !== "string") {
      return new Response(JSON.stringify({ error: "booking_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select("id, customer_email, customer_name, payment_status, booking_date, booking_time, room_title, stripe_session_id, amount_cents, refund_status")
      .eq("id", booking_id)
      .single();

    if (fetchError || !booking) {
      return new Response(JSON.stringify({ error: "Booking not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (booking.customer_email !== user.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (booking.payment_status === "cancelled") {
      return new Response(JSON.stringify({ error: "Already cancelled" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enforce cancellation cutoff (admin-configurable; 24h fallback)
    const bookingDateTime = new Date(`${booking.booking_date}T${booking.booking_time || "00:00"}`);
    const now = new Date();
    const hoursUntil = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    const cutoffHours = await resolveCancellationCutoffHours(24);
    if (hoursUntil < cutoffHours) {
      return new Response(JSON.stringify({ error: `Cancellation requires at least ${cutoffHours} hours notice before your session` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cancel the booking
    const { error: updateError } = await supabase
      .from("bookings")
      .update({ payment_status: "cancelled" })
      .eq("id", booking_id);

    if (updateError) {
      return new Response(JSON.stringify({ error: "Failed to cancel" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auto-refund if the booking was paid. Mirrors request-refund's auto-approve
    // path so a cancellation within the cutoff window returns the customer's money.
    let refundedCents = 0;
    if (
      booking.payment_status === "paid" &&
      booking.stripe_session_id &&
      booking.refund_status !== "processed" &&
      booking.refund_status !== "pending"
    ) {
      try {
        const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
          apiVersion: "2024-11-20.acacia",
        });

        const { data: refundReq } = await supabase
          .from("refund_requests")
          .insert({
            booking_id: booking.id,
            customer_email: booking.customer_email,
            customer_name: booking.customer_name,
            reason: "Customer cancellation",
            amount_cents: booking.amount_cents,
            status: "auto_approved",
            hours_before_session: hoursUntil,
          })
          .select()
          .single();

        const session = await stripe.checkout.sessions.retrieve(booking.stripe_session_id);
        const pi = typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id;

        if (pi) {
          const refund = await stripe.refunds.create({
            payment_intent: pi,
            reason: "requested_by_customer",
          }, {
            idempotencyKey: `cancel-refund-${booking.id}`,
          });
          refundedCents = booking.amount_cents;

          await supabase.from("refund_requests").update({
            status: "processed",
            stripe_refund_id: refund.id,
            processed_at: new Date().toISOString(),
          }).eq("id", refundReq!.id);

          await supabase.from("bookings").update({
            payment_status: "refunded",
            refund_status: "processed",
            refunded_amount_cents: refundedCents,
          }).eq("id", booking_id);
        }
      } catch (refundErr) {
        console.error("Auto-refund failed:", refundErr);
        // Don't fail the cancel — admin will see the failed refund_request and follow up.
      }
    }

    // Send cancellation confirmation email
    await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "booking-cancelled",
        recipientEmail: booking.customer_email,
        idempotencyKey: `cancel-${booking_id}`,
        templateData: {
          customerName: booking.customer_name,
          roomTitle: booking.room_title,
          bookingDate: booking.booking_date,
          bookingTime: booking.booking_time,
        },
      },
    });

    // Create in-app notification
    await supabase.from("notifications").insert({
      user_email: booking.customer_email,
      title: "Booking Cancelled",
      message: `Your ${booking.room_title} session on ${booking.booking_date} has been cancelled.`,
      type: "cancellation",
      booking_id: booking_id,
    });

    // Send admin SMS notification
    try {
      const smsBody = `❌ Booking Cancelled\n${booking.customer_name}\n${booking.room_title}\n${booking.booking_date} @ ${booking.booking_time}`;
      await sendTwilioSms(resolveAdminPhones(), smsBody);
    } catch (smsErr) {
      console.error("Failed to send admin cancel SMS", smsErr);
    }

    // Notify waitlisted users for this slot
    const { data: waitlistEntries } = await supabase
      .from("waitlist")
      .select("id, user_email")
      .eq("room_title", booking.room_title)
      .eq("booking_date", booking.booking_date)
      .eq("booking_time", booking.booking_time)
      .eq("notified", false);

    if (waitlistEntries && waitlistEntries.length > 0) {
      for (const entry of waitlistEntries) {
        // Send email notification
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "waitlist-spot-open",
            recipientEmail: entry.user_email,
            idempotencyKey: `waitlist-notify-${entry.id}`,
            templateData: {
              roomTitle: booking.room_title,
              bookingDate: booking.booking_date,
              bookingTime: booking.booking_time,
            },
          },
        });

        // In-app notification
        await supabase.from("notifications").insert({
          user_email: entry.user_email,
          title: "Spot Available!",
          message: `A spot opened up for ${booking.room_title} on ${booking.booking_date} at ${booking.booking_time}. Book now!`,
          type: "waitlist",
        });

        // Mark as notified
        await supabase
          .from("waitlist")
          .update({ notified: true, notified_at: new Date().toISOString() })
          .eq("id", entry.id);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
