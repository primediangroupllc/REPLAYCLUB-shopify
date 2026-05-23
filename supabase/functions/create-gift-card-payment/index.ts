import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GIFT_CARD_PRICES: Record<number, string> = {
  2500: "price_1TGRExLdPf5ArdG2UtkuHIXl",
  5000: "price_1TGRFMLdPf5ArdG2qtUrbmTY",
  10000: "price_1TGRFwLdPf5ArdG2AipPbORj",
};

function generateGiftCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "RC-";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { amountCents, recipientEmail, recipientName, personalMessage, idempotencyKey } = await req.json();

    if (!amountCents || !GIFT_CARD_PRICES[amountCents]) {
      return new Response(JSON.stringify({ error: "Invalid gift card amount" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Auth is optional for gift card purchases (guests can buy)
    let purchaserEmail: string | null = null;
    let purchaserUserId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data } = await supabase.auth.getUser(token);
      if (data?.user) {
        purchaserEmail = data.user.email || null;
        purchaserUserId = data.user.id;
      }
    }

    const giftCode = generateGiftCode();

    // Create gift card record
    const { data: giftCard, error: insertErr } = await supabase
      .from("gift_cards")
      .insert({
        code: giftCode,
        amount_cents: amountCents,
        balance_cents: amountCents,
        purchaser_email: purchaserEmail,
        purchaser_user_id: purchaserUserId,
        recipient_email: recipientEmail || null,
        recipient_name: recipientName || null,
        personal_message: personalMessage || null,
        payment_status: "pending",
      })
      .select()
      .single();

    if (insertErr) throw new Error(`Failed to create gift card: ${insertErr.message}`);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check for existing Stripe customer
    let customerId: string | undefined;
    if (purchaserEmail) {
      const customers = await stripe.customers.list({ email: purchaserEmail, limit: 1 });
      if (customers.data.length > 0) customerId = customers.data[0].id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : (purchaserEmail || undefined),
      line_items: [{ price: GIFT_CARD_PRICES[amountCents], quantity: 1 }],
      mode: "payment",
      payment_intent_data: amountCents > 20000
        ? { payment_method_options: { card: { request_three_d_secure: "any" } } }
        : undefined,
      metadata: {
        gift_card_id: giftCard.id,
        type: "gift_card",
      },
      success_url: `${req.headers.get("origin")}/gift-cards?success=true&code=${giftCode}`,
      cancel_url: `${req.headers.get("origin")}/gift-cards?canceled=true`,
    });

    // Store stripe session ID
    await supabase
      .from("gift_cards")
      .update({ stripe_session_id: session.id })
      .eq("id", giftCard.id);

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

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Gift card payment error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
