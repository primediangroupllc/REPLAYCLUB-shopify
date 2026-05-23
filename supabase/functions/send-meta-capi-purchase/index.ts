// Server-side Meta Conversions API (CAPI) Purchase event sender.
// Invoked by stripe-webhook after a booking/rental is paid.
// Browser pixel fires the same event_id so Meta can dedupe.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// SHA-256 helper for hashing PII (Meta requires hashed email/phone)
async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.trim().toLowerCase());
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface PurchaseBody {
  eventId: string;          // shared with browser pixel for dedup
  email?: string;
  phone?: string;
  valueUsd: number;
  currency?: string;
  contentName?: string;     // e.g., "DJ Studio - 2hr"
  contentCategory?: string; // e.g., "booking" | "rental"
  sourceUrl?: string;
  clientIp?: string;
  userAgent?: string;
  fbp?: string;             // _fbp cookie
  fbc?: string;             // _fbc cookie
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as PurchaseBody;
    if (!body.eventId || typeof body.valueUsd !== "number") {
      return new Response(JSON.stringify({ error: "missing eventId or valueUsd" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Pull pixel id + token from site_settings (admin-only readable; service role bypasses RLS)
    const { data: settings } = await supabase
      .from("site_settings")
      .select("meta_pixel_id, meta_capi_token")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    const pixelId = settings?.meta_pixel_id?.trim();
    const token = settings?.meta_capi_token?.trim();
    if (!pixelId || !token) {
      // Pixel/token not configured yet — soft no-op so app still works.
      return new Response(JSON.stringify({ skipped: true, reason: "capi_not_configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userData: Record<string, unknown> = {};
    if (body.email) userData.em = [await sha256(body.email)];
    if (body.phone) {
      // strip non-digits before hashing per Meta spec
      const digits = body.phone.replace(/[^\d]/g, "");
      if (digits) userData.ph = [await sha256(digits)];
    }
    if (body.clientIp) userData.client_ip_address = body.clientIp;
    if (body.userAgent) userData.client_user_agent = body.userAgent;
    if (body.fbp) userData.fbp = body.fbp;
    if (body.fbc) userData.fbc = body.fbc;

    const payload = {
      data: [{
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: body.eventId,
        action_source: "website",
        event_source_url: body.sourceUrl,
        user_data: userData,
        custom_data: {
          currency: body.currency ?? "USD",
          value: Number(body.valueUsd.toFixed(2)),
          content_name: body.contentName,
          content_category: body.contentCategory,
          content_type: "product",
        },
      }],
    };

    const url = `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${encodeURIComponent(token)}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await resp.text();
    if (!resp.ok) {
      console.error("Meta CAPI error", resp.status, text);
      return new Response(JSON.stringify({ ok: false, status: resp.status, body: text }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, response: text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("CAPI handler error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
