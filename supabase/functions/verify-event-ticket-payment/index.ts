import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function generateTicketCode(): string {
  // 8-char human-readable code (no ambiguous chars)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const { sessionId, rsvpId } = await req.json();
    if (!sessionId || !rsvpId) {
      return new Response(JSON.stringify({ error: "Missing sessionId or rsvpId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return new Response(
        JSON.stringify({ success: false, status: session.payment_status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Idempotent confirm
    const { data: existing } = await supabase
      .from("event_rsvps")
      .select("*, events(*)")
      .eq("id", rsvpId)
      .single();

    if (!existing) {
      return new Response(JSON.stringify({ error: "RSVP not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (existing.payment_status === "paid") {
      return new Response(
        JSON.stringify({ success: true, alreadyConfirmed: true, rsvp: existing }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ticketCode = existing.ticket_code || generateTicketCode();

    // Atomic confirm with capacity check
    const { data: confirmRes, error: confirmErr } = await supabase.rpc(
      "confirm_event_rsvp_with_capacity",
      { p_rsvp_id: rsvpId, p_ticket_code: ticketCode }
    );

    if (confirmErr) throw new Error(confirmErr.message);

    const result = Array.isArray(confirmRes) ? confirmRes[0] : confirmRes;

    if (result?.over_capacity) {
      // Refund the customer — event is full, moved to waitlist
      try {
        if (session.payment_intent) {
          await stripe.refunds.create({
            payment_intent: session.payment_intent as string,
            reason: "requested_by_customer",
          });
        }
      } catch (refundErr) {
        console.error("Auto-refund failed:", refundErr);
      }
      return new Response(
        JSON.stringify({
          success: false,
          overCapacity: true,
          message: "Event reached capacity. You've been moved to the waitlist and refunded.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: updated } = await supabase
      .from("event_rsvps")
      .select("*, events(*)")
      .eq("id", rsvpId)
      .single();

    // Send confirmation email (best-effort)
    try {
      await supabase.functions.invoke("send-event-confirmation", {
        body: { rsvpId: updated.id },
      });
    } catch (e) {
      console.error("send-event-confirmation failed:", e);
    }

    return new Response(JSON.stringify({ success: true, rsvp: updated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("verify-event-ticket-payment error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
