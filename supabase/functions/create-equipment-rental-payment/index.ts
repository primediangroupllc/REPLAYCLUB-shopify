import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { checkRateLimit, clientIp, rateLimitResponse } from "../_shared/rate-limit.ts";
import { resolveEquipmentLockTtlSeconds } from "../_shared/site-settings.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";

interface RentalItem {
  name: string;
  priceCents: number;
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const ip = clientIp(req);
    const ipLimit = await checkRateLimit({
      bucket: "create-equipment-rental-payment:ip",
      identifier: ip,
      max: 20,
      windowSeconds: 60,
    });
    if (!ipLimit.allowed) return rateLimitResponse(ipLimit, corsHeaders);

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    const emailLimit = await checkRateLimit({
      bucket: "create-equipment-rental-payment:email",
      identifier: user.email,
      max: 10,
      windowSeconds: 60,
    });
    if (!emailLimit.allowed) return rateLimitResponse(emailLimit, corsHeaders);

    const { items, rentalDays, pickupDate, consentSignaturePath, consentSignerName, idempotencyKey } = await req.json() as {
      items: RentalItem[];
      rentalDays: number;
      pickupDate: string | null;
      consentSignaturePath?: string | null;
      consentSignerName?: string | null;
      idempotencyKey?: string | null;
    };

    if (!items || items.length === 0) throw new Error("No items selected");
    if (![1, 3, 7].includes(rentalDays)) throw new Error("Invalid rental duration");
    if (!consentSignaturePath || !consentSignerName?.trim()) {
      throw new Error("Rental consent signature is required");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ──────────────────────────────────────────────────────────────────────
    // Server-authoritative pricing (audit #7, Phase 2).
    //
    // `item.priceCents` arrives from the browser and is NOT trusted — a
    // tampered request could otherwise rent any gear down to the $0 floor.
    // The charge is recomputed from the admin-managed `custom_equipment_items`
    // catalog, keyed by item name, with the multi-day discount applied
    // server-side. Any submitted name that isn't a bookable catalog item
    // rejects the whole order — fail closed.
    // Platform/transaction fee removed for public launch (PR 4c).
    // ──────────────────────────────────────────────────────────────────────
    const RENTAL_DISCOUNT: Record<number, number> = { 1: 0, 3: 0.05, 7: 0.1 };
    const discount = RENTAL_DISCOUNT[rentalDays] ?? 0;

    const requestedNames = [...new Set(items.map((i) => i.name))];
    const { data: catalogRows, error: catalogErr } = await supabaseAdmin
      .from("custom_equipment_items")
      .select("name, price_cents, bookable")
      .in("name", requestedNames);
    if (catalogErr) throw new Error("Could not verify equipment pricing. Please try again.");

    const priceByName = new Map<string, number>();
    for (const row of (catalogRows ?? []) as Array<{ name: string; price_cents: number; bookable: boolean }>) {
      if (row.bookable) priceByName.set(row.name, row.price_cents);
    }

    let subtotalCents = 0;
    for (const item of items) {
      const basePrice = priceByName.get(item.name);
      if (basePrice === undefined) {
        throw new Error(`"${item.name}" is not available to rent. Please refresh and try again.`);
      }
      subtotalCents += Math.round(basePrice * (1 - discount)) * rentalDays;
    }
    const totalCents = subtotalCents;
    if (totalCents < 100) {
      throw new Error("This rental total is too low to check out online. Please contact us.");
    }

    // Idempotency: replay-safe checkout for double-clicks / retries.
    if (idempotencyKey && typeof idempotencyKey === "string") {
      const { data: existing } = await supabaseAdmin
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

    // Acquire equipment locks for every item (10 min TTL) before creating payment
    const lockPickup = pickupDate || new Date().toISOString().slice(0, 10);
    const acquiredLockIds: string[] = [];
    const equipTtlSeconds = await resolveEquipmentLockTtlSeconds(600);
    for (const item of items) {
      const { data: lockRows, error: lockErr } = await supabaseAdmin.rpc("acquire_equipment_lock", {
        p_equipment_name: item.name,
        p_pickup_date: lockPickup,
        p_rental_days: rentalDays,
        p_email: user.email,
        p_ttl_seconds: equipTtlSeconds,
      });
      const row = Array.isArray(lockRows) ? lockRows[0] : null;
      if (lockErr || !row?.acquired) {
        // Release any locks we already grabbed
        if (acquiredLockIds.length > 0) {
          await supabaseAdmin.rpc("release_equipment_locks", { p_lock_ids: acquiredLockIds });
        }
        throw new Error(`"${item.name}" is currently held by another renter. Please try again in a few minutes.`);
      }
      acquiredLockIds.push(row.lock_id);
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check existing customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data.length > 0 ? customers.data[0].id : undefined;

    const itemDescription = items.map(i => i.name).join(", ");

    let session;
    try {
      session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Equipment Rental (${rentalDays} day${rentalDays > 1 ? "s" : ""})`,
              description: itemDescription,
            },
            unit_amount: subtotalCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      payment_intent_data: totalCents > 20000
        ? { payment_method_options: { card: { request_three_d_secure: "any" } } }
        : undefined,
      success_url: `${req.headers.get("origin")}/equipment-rental?success=true`,
      cancel_url: `${req.headers.get("origin")}/equipment-rental`,
      metadata: {
        type: "equipment_rental",
        items: JSON.stringify(items.map(i => i.name)),
        rental_days: String(rentalDays),
        pickup_date: pickupDate || "",
        equipment_lock_ids: JSON.stringify(acquiredLockIds),
      },
      });
    } catch (stripeErr) {
      // Stripe failed → release locks immediately
      await supabaseAdmin.rpc("release_equipment_locks", { p_lock_ids: acquiredLockIds });
      throw stripeErr;
    }

    const { error: insertErr } = await supabaseAdmin.from("equipment_rentals").insert({
      customer_email: user.email,
      customer_name: user.user_metadata?.display_name || user.email,
      items: items.map(i => i.name),
      rental_days: rentalDays,
      amount_cents: totalCents,
      stripe_session_id: session.id,
      pickup_date: pickupDate || null,
      consent_signature_path: consentSignaturePath,
      consent_signer_name: consentSignerName.trim(),
      consent_signed_at: new Date().toISOString(),
    });
    if (insertErr) {
      await supabaseAdmin.rpc("release_equipment_locks", { p_lock_ids: acquiredLockIds });
      throw insertErr;
    }

    if (idempotencyKey && typeof idempotencyKey === "string" && session.url) {
      await supabaseAdmin.from("stripe_checkout_idempotency").upsert(
        {
          idempotency_key: idempotencyKey,
          stripe_session_id: session.id,
          stripe_session_url: session.url,
        },
        { onConflict: "idempotency_key" },
      );
    }

    return new Response(JSON.stringify({ url: session.url, lockIds: acquiredLockIds }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Equipment rental payment error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
