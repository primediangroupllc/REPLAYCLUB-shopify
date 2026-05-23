import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Stripe fee that we absorb into the displayed ticket price.
// Buyer sees the headline price; we gross it up so net == headline price.
// US standard rate ~ 2.9% + $0.30. We use 3% + $0.50 as a comfy buffer
// (matches the project's $3.33 transaction-fee philosophy without surfacing it).
function grossUpForStripeFee(displayCents: number): number {
  // displayed = (charged - 50) * 0.97  =>  charged = (displayed / 0.97) + 50
  return Math.ceil(displayCents / 0.97) + 50;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { eventId, customerName, customerEmail, fromWaitlistRsvpId, referringHostToken, idempotencyKey, tierId } = await req.json();

    if (!eventId || !customerName || !customerEmail) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Idempotency guard
    if (idempotencyKey && typeof idempotencyKey === "string") {
      const { data: existing } = await supabase
        .from("stripe_checkout_idempotency")
        .select("stripe_session_url")
        .eq("idempotency_key", idempotencyKey)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (existing?.stripe_session_url) {
        return new Response(JSON.stringify({ url: existing.stripe_session_url, resumed: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Load event
    const { data: event, error: eventErr } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();

    if (eventErr || !event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event.status !== "published") {
      return new Response(JSON.stringify({ error: "Event is not available for purchase" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Tier-aware pricing & capacity. If tierId provided, use that tier; else fall back to event-level price/capacity.
    let displayPriceCents = event.price_cents;
    let tierName: string | null = null;
    let resolvedTierId: string | null = null;

    if (tierId) {
      const { data: tier, error: tierErr } = await supabase
        .from("event_ticket_tiers")
        .select("*")
        .eq("id", tierId)
        .eq("event_id", eventId)
        .maybeSingle();
      if (tierErr || !tier) {
        return new Response(JSON.stringify({ error: "Ticket tier not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (tier.sold_out) {
        return new Response(JSON.stringify({ error: "This tier is sold out", soldOut: true }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (tier.is_free || tier.price_cents <= 0) {
        return new Response(JSON.stringify({ error: "Free tier — RSVP directly" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Per-tier capacity check
      if (!fromWaitlistRsvpId) {
        const { count } = await supabase
          .from("event_rsvps")
          .select("id", { count: "exact", head: true })
          .eq("event_id", eventId)
          .eq("ticket_tier_id", tier.id)
          .eq("payment_status", "paid")
          .eq("status", "confirmed");
        if ((count ?? 0) >= tier.capacity) {
          return new Response(JSON.stringify({ error: "This tier is sold out", soldOut: true }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      displayPriceCents = tier.price_cents;
      tierName = tier.name;
      resolvedTierId = tier.id;
    } else {
      if (event.price_cents <= 0) {
        return new Response(JSON.stringify({ error: "This is a free event — RSVP directly" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!fromWaitlistRsvpId) {
        const { data: attendance } = await supabase.rpc("get_event_attendance", { p_event_id: eventId });
        const confirmed = (attendance as { confirmed_count?: number } | null)?.confirmed_count ?? 0;
        if (confirmed >= event.capacity) {
          return new Response(JSON.stringify({ error: "Event is sold out", soldOut: true }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Reuse customer if exists
    const customers = await stripe.customers.list({ email: customerEmail, limit: 1 });
    const customerId = customers.data.length > 0 ? customers.data[0].id : undefined;

    const chargeAmount = grossUpForStripeFee(displayPriceCents);

    // Upsert the RSVP in pending_payment state
    let rsvpId = fromWaitlistRsvpId as string | undefined;
    if (rsvpId) {
      await supabase
        .from("event_rsvps")
        .update({
          status: "pending_payment",
          payment_status: "pending",
          user_name: customerName,
          ticket_tier_id: resolvedTierId,
        })
        .eq("id", rsvpId);
    } else {
      // Try to insert; if a row already exists (e.g. a prior cancelled/waitlist), update it
      const { data: existing } = await supabase
        .from("event_rsvps")
        .select("id, status")
        .eq("event_id", eventId)
        .ilike("user_email", customerEmail)
        .maybeSingle();

      if (existing) {
        rsvpId = existing.id;
        await supabase
          .from("event_rsvps")
          .update({
            status: "pending_payment",
            payment_status: "pending",
            user_name: customerName,
            ticket_tier_id: resolvedTierId,
          })
          .eq("id", existing.id);
      } else {
        const { data: created, error: createErr } = await supabase
          .from("event_rsvps")
          .insert({
            event_id: eventId,
            user_email: customerEmail,
            user_name: customerName,
            status: "pending_payment",
            payment_status: "pending",
            amount_paid_cents: 0,
            ticket_tier_id: resolvedTierId,
          })
          .select("id")
          .single();
        if (createErr || !created) throw new Error(`RSVP create error: ${createErr?.message}`);
        rsvpId = created.id;
      }
    }

    // Resolve referring host (if any) and attribute the sale
    if (referringHostToken && typeof referringHostToken === "string") {
      const { data: hostRow } = await supabase
        .from("event_hosts")
        .select("id, event_id, revoked")
        .eq("token", referringHostToken)
        .maybeSingle();
      if (hostRow && !hostRow.revoked && hostRow.event_id === eventId) {
        await supabase
          .from("event_rsvps")
          .update({ referring_host_id: hostRow.id })
          .eq("id", rsvpId!);
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : customerEmail,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${event.title} — ${tierName ?? "Ticket"}`,
              description: `${event.event_date} · ${event.start_time}${event.room_title ? ` · ${event.room_title}` : ""}`,
            },
            unit_amount: chargeAmount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      payment_intent_data: chargeAmount > 20000
        ? { payment_method_options: { card: { request_three_d_secure: "any" } } }
        : undefined,
      success_url:
        `${req.headers.get("origin")}/events/${event.slug ?? eventId}/confirmation?ticket_session_id={CHECKOUT_SESSION_ID}&rsvp_id=${rsvpId}`,
      cancel_url: `${req.headers.get("origin")}/events/${event.slug ?? eventId}?ticket_cancelled=true`,
      metadata: {
        event_id: eventId,
        rsvp_id: rsvpId!,
        tier_id: resolvedTierId ?? "",
        kind: "event_ticket",
      },
    });

    await supabase
      .from("event_rsvps")
      .update({
        stripe_session_id: session.id,
        amount_paid_cents: displayPriceCents,
      })
      .eq("id", rsvpId!);

    if (idempotencyKey && typeof idempotencyKey === "string" && session.url) {
      await supabase.from("stripe_checkout_idempotency").upsert(
        {
          idempotency_key: idempotencyKey,
          stripe_session_id: session.id,
          stripe_session_url: session.url,
        },
        { onConflict: "idempotency_key" },
      );
    }

    return new Response(
      JSON.stringify({ url: session.url, rsvpId, chargeAmount, displayedAmount: displayPriceCents }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("create-event-ticket-payment error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
