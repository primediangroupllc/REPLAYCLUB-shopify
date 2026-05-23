import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { checkRateLimit, clientIp, rateLimitResponse } from "../_shared/rate-limit.ts";

/**
 * Stripe Identity — create a verification session for a booking.
 *
 * Flow:
 *   1. Authenticate the caller (must be the booking's owner by email).
 *   2. Lookup the booking; bail if it's already approved.
 *   3. Rate-limit: 5 sessions / hour / user (per spec).
 *   4. Create a Stripe Identity session with `metadata.booking_id` so the
 *      shared `stripe-webhook` handler can route the result back.
 *   5. Upsert an `id_verifications` row (provider = 'stripe_identity').
 *   6. Move booking → `verification_status = 'pending_ocr'` with a 24h hold.
 *   7. Return `{ url, session_id }` so the client can redirect.
 *
 * No CORS preflight here — the function is invoked via the Supabase JS SDK,
 * which sets the standard headers. We still allow the OPTIONS path for safety.
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-08-27.basil",
});

function siteUrl(req: Request): string {
  // Prefer an explicit override env, fall back to the Origin header so
  // preview/staging/production all redirect back to the right host.
  const fromEnv = Deno.env.get("SITE_URL");
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const origin = req.headers.get("origin");
  if (origin) return origin.replace(/\/$/, "");
  return "https://www.replayclub.io";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: userData, error: userErr } = await admin.auth.getUser(
      authHeader.slice("Bearer ".length),
    );
    const user = userData?.user;
    if (userErr || !user?.id || !user.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PR 4a — Defense in depth: while site_settings.verification_v2_admin_only
    // is true, only admins can create Stripe Identity sessions. The frontend
    // also gates the new flow on bootstrap.isAdmin, but if a non-admin
    // somehow reaches this endpoint we refuse here too.
    {
      const { data: settings } = await admin
        .from("site_settings")
        .select("verification_v2_admin_only")
        .order("id", { ascending: true })
        .limit(1)
        .maybeSingle();
      const adminOnly = settings?.verification_v2_admin_only ?? true;
      if (adminOnly) {
        const { data: roleRow } = await admin
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();
        if (!roleRow) {
          return new Response(
            JSON.stringify({ error: "verification_v2_disabled" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
    }

    const body = await req.json().catch(() => ({}));
    const bookingId = String(body?.booking_id ?? "");
    // Optional: the inline single-page booking flow passes its landing-page
    // path so Stripe returns the user there instead of the homepage modal.
    // BookingReturn validates this is a safe same-site path before using it.
    const returnPath = typeof body?.return_path === "string" ? body.return_path : "";
    if (!bookingId) {
      return new Response(JSON.stringify({ error: "missing_booking_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate-limit: per-user 5/hour, plus a softer per-IP backstop.
    const userLimit = await checkRateLimit({
      bucket: "identity_session_create",
      identifier: user.id,
      max: 5,
      windowSeconds: 3600,
    });
    if (!userLimit.allowed) return rateLimitResponse(userLimit, corsHeaders);

    const ipLimit = await checkRateLimit({
      bucket: "identity_session_create_ip",
      identifier: clientIp(req),
      max: 20,
      windowSeconds: 3600,
    });
    if (!ipLimit.allowed) return rateLimitResponse(ipLimit, corsHeaders);

    // Booking ownership check: bookings has no user_id column, so we match
    // on customer_email vs the authenticated user's verified email.
    const { data: booking, error: bErr } = await admin
      .from("bookings")
      .select("id, customer_email, customer_name, verification_status")
      .eq("id", bookingId)
      .maybeSingle();

    if (bErr || !booking) {
      return new Response(JSON.stringify({ error: "booking_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (booking.customer_email?.toLowerCase() !== user.email.toLowerCase()) {
      return new Response(JSON.stringify({ error: "not_owner" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (booking.verification_status === "approved") {
      return new Response(JSON.stringify({ already_verified: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create the Stripe Identity session.
    const session = await stripe.identity.verificationSessions.create({
      type: "document",
      metadata: {
        booking_id: bookingId,
        user_id: user.id,
      },
      options: {
        document: {
          allowed_types: ["driving_license", "passport", "id_card"],
          require_id_number: false,
          require_live_capture: true,
          require_matching_selfie: true,
        },
      },
      return_url: `${siteUrl(req)}/booking/return?booking_id=${bookingId}${
        returnPath ? `&return_to=${encodeURIComponent(returnPath)}` : ""
      }`,
    });

    // Upsert the verifications row. Image path / capture method are NULL —
    // Stripe holds the document; we only store the session reference.
    const { error: ivErr } = await admin
      .from("id_verifications")
      .upsert(
        {
          booking_id: bookingId,
          user_id: user.id,
          ocr_provider: "stripe_identity",
          stripe_verification_session_id: session.id,
          review_status: "pending",
          id_image_path: null,
          id_capture_method: null,
        },
        { onConflict: "booking_id" },
      );
    if (ivErr) {
      console.error("[identity] failed to upsert verification row:", ivErr.message);
    }

    // Hold the slot for 24 hours while Stripe processes.
    const heldUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { error: bUpdErr } = await admin
      .from("bookings")
      .update({
        verification_status: "pending_ocr",
        verification_held_until: heldUntil,
      })
      .eq("id", bookingId);
    if (bUpdErr) {
      console.error("[identity] failed to mark booking pending:", bUpdErr.message);
    }

    // Extend the slot_lock to 30 minutes so nobody else can grab the slot
    // while Stripe processes the document. Releases happen on terminal
    // verification states (rejected/canceled) via the webhook, or naturally
    // when create-booking-payment consumes the lock for the approved path.
    const { error: lockErr } = await admin.rpc(
      "extend_slot_lock_for_verification",
      { p_booking_id: bookingId, p_extension_minutes: 30 },
    );
    if (lockErr) {
      // Non-fatal: log it. The slot may already be expired and another user
      // may grab it, but we still let Stripe Identity continue — the user
      // gets a clearer failure later if the slot is gone.
      console.error("[identity] failed to extend slot lock:", lockErr.message);
    }

    return new Response(
      JSON.stringify({
        url: session.url,
        session_id: session.id,
        client_secret: session.client_secret,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[identity] unhandled error:", msg);
    return new Response(
      JSON.stringify({ error: "internal_error", detail: msg }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});