import { createClient } from "npm:@supabase/supabase-js@2";
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
    const { email } = await req.json();
    console.log("Received verification request for:", email);

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Valid email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ip = clientIp(req);
    const ipLimit = await checkRateLimit({
      bucket: "send-verification-email-ip",
      identifier: ip,
      max: 5,
      windowSeconds: 60,
    });
    if (!ipLimit.allowed) return rateLimitResponse(ipLimit, corsHeaders);

    const emailLimit = await checkRateLimit({
      bucket: "send-verification-email-addr",
      identifier: email.toLowerCase(),
      max: 3,
      windowSeconds: 60,
    });
    if (!emailLimit.allowed) return rateLimitResponse(emailLimit, corsHeaders);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Generate a 7-digit code
    const code = Math.floor(1000000 + Math.random() * 9000000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Store code
    const { error: insertError } = await supabase
      .from("verification_codes")
      .insert({ phone: email, code, expires_at: expiresAt });

    if (insertError) {
      console.error("Insert error:", insertError);
      throw insertError;
    }
    console.log("Verification code stored successfully");

    // Send email via transactional email system
    const { data: emailResult, error: emailError } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "booking-verification-code",
        recipientEmail: email,
        idempotencyKey: `booking-verify-${email}-${Date.now()}`,
        templateData: { code },
      },
    });

    console.log("Email result:", JSON.stringify(emailResult));
    if (emailError) {
      console.error("Email invoke error:", emailError);
      throw emailError;
    }
    if (emailResult?.error) throw new Error(emailResult.error);
    if (emailResult?.success === false) {
      throw new Error(emailResult.reason || "Failed to queue verification email");
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-verification-email error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
