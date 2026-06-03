import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { resolveSmsFrom } from "../_shared/site-settings.ts";
import { refundDuplicateSlotLoser } from "../_shared/duplicate-slot.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, bookingId } = await req.json();
    if (!sessionId || !bookingId) {
      return new Response(JSON.stringify({ error: "Missing sessionId or bookingId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify payment with Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === "paid") {
      // Update booking status
      const { data: booking, error: updateErr } = await supabase
        .from("bookings")
        .update({ payment_status: "paid" })
        .eq("id", bookingId)
        .eq("stripe_session_id", sessionId)
        .select()
        .single();

      // 23505 = bookings_unique_paid_slot_idx fired: another paid booking already
      // won this slot. This customer was charged — refund them (idempotent helper,
      // safe even if stripe-webhook also refunds via the same keyed call).
      if ((updateErr as { code?: string } | null)?.code === "23505") {
        const pi = typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null;
        const { data: lost } = await supabase
          .from("bookings")
          .select("room_title, booking_date, booking_time, amount_cents, customer_email")
          .eq("id", bookingId)
          .single();
        await refundDuplicateSlotLoser(stripe, supabase, {
          bookingId,
          paymentIntentId: pi,
          amountCents: lost?.amount_cents ?? 0,
          customerEmail: lost?.customer_email,
          slot: {
            room_title: lost?.room_title,
            booking_date: lost?.booking_date,
            booking_time: lost?.booking_time,
          },
        });
        // 200 (not 4xx) so functions.invoke surfaces the body to the client,
        // which shows the refund message. Matches this function's existing
        // "success: false" not-paid response shape below.
        return new Response(
          JSON.stringify({ success: false, status: "slot_taken", refunded: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (booking) {
        // Send confirmation SMS
        const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
        const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
        const fromPhone = await resolveSmsFrom();

        if (accountSid && authToken && fromPhone) {
          try {
            await fetch(
              `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
              {
                method: "POST",
                headers: {
                  "Authorization": "Basic " + btoa(`${accountSid}:${authToken}`),
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                  To: booking.customer_phone,
                  From: fromPhone,
                  Body: `✅ Replay Club Booking Confirmed!\n\n${booking.room_title}\n📅 ${booking.booking_date} at ${booking.booking_time}\n💰 $${(booking.amount_cents / 100).toFixed(2)}\n\nSee you there! 🎶`,
                }),
              }
            );
          } catch (smsError) {
            console.error("SMS confirmation failed:", smsError);
          }
        }

        // Send booking confirmation email
        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          await fetch(`${supabaseUrl}/functions/v1/send-booking-confirmation`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${serviceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ bookingId: booking.id }),
          });
        } catch (emailError) {
          console.error("Email confirmation failed:", emailError);
        }
      }

      return new Response(JSON.stringify({ success: true, booking }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: false, status: session.payment_status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
