import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { checkRateLimit, clientIp, rateLimitResponse } from "../_shared/rate-limit.ts";

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
    // Rate-limit by IP (5 attempts/min) to deter brute-force on the 7-digit
    // code and reduce verification_codes lookup load.
    const ip = clientIp(req);
    const ipLimit = await checkRateLimit({
      bucket: "verify-email-code:ip",
      identifier: ip,
      max: 5,
      windowSeconds: 60,
    });
    if (!ipLimit.allowed) return rateLimitResponse(ipLimit, corsHeaders);

    const { email, code } = await req.json();
    if (!email || !code) {
      return new Response(JSON.stringify({ error: "Email and code are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Per-email cap as a second guard so a single victim address can't be
    // hammered from a botnet of IPs.
    const emailLimit = await checkRateLimit({
      bucket: "verify-email-code:email",
      identifier: String(email).toLowerCase(),
      max: 5,
      windowSeconds: 60,
    });
    if (!emailLimit.allowed) return rateLimitResponse(emailLimit, corsHeaders);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find matching unexpired, unverified code
    const { data: codes, error: fetchError } = await supabase
      .from("verification_codes")
      .select("*")
      .eq("phone", email)
      .eq("code", code)
      .eq("verified", false)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1);

    if (fetchError) throw fetchError;

    if (!codes || codes.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid or expired code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark as verified
    await supabase
      .from("verification_codes")
      .update({ verified: true })
      .eq("id", codes[0].id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
