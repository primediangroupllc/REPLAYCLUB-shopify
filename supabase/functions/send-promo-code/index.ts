import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.3";
import { resolveFromHeader } from "../_shared/site-settings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the caller using getClaims
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { promo_id, recipient_email } = await req.json();

    if (!promo_id || !recipient_email) {
      return new Response(
        JSON.stringify({ error: "promo_id and recipient_email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the promo code
    const { data: promo, error: promoError } = await supabase
      .from("promo_codes")
      .select("*")
      .eq("id", promo_id)
      .single();

    if (promoError || !promo) {
      return new Response(
        JSON.stringify({ error: "Promo code not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (promo.redeemed) {
      return new Response(
        JSON.stringify({ error: "Promo code already redeemed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the promo with recipient email
    await supabase
      .from("promo_codes")
      .update({ recipient_email })
      .eq("id", promo_id);

    // Generate or retrieve unsubscribe token for this recipient
    const unsubscribeToken = crypto.randomUUID();
    const { error: tokenError } = await supabase
      .from("email_unsubscribe_tokens")
      .upsert(
        { email: recipient_email, token: unsubscribeToken },
        { onConflict: "email" }
      );

    if (tokenError) {
      console.error("Failed to create unsubscribe token", tokenError);
    }

    // Get the actual stored token (in case upsert kept the existing one)
    const { data: tokenRow } = await supabase
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", recipient_email)
      .single();

    const finalToken = tokenRow?.token || unsubscribeToken;

    // Enqueue email with the 7-digit code
    const idempotencyKey = `promo-${promo_id}`;
    const emailText = [
      "Your Free Session Awaits",
      `You've been invited to a complimentary ${promo.room_title} session at Replay Club.`,
      `Your redemption code: ${promo.code}`,
      "Enter this code on the promo page to unlock your free session. This code is single-use.",
      `Sign in and redeem here: https://www.replayclub.io/promo/${promo.token}`,
    ].join("\n\n");

    const fromHeader = await resolveFromHeader(
      "default",
      "Replay Club",
      "replayclub.io",
    );
    const emailPayload = {
      to: recipient_email,
      from: fromHeader,
      sender_domain: "replayclub.io",
      reply_to: "replayclubrecords@gmail.com",
      subject: `Your Free Session Code — Replay Club`,
      purpose: "transactional",
      idempotency_key: idempotencyKey,
      message_id: idempotencyKey,
      label: "promo_code",
      queued_at: new Date().toISOString(),
      text: emailText,
      unsubscribe_token: finalToken,
      html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Your Free Session</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:'Space Grotesk',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0a0a0a 0%,#1a1a1a 100%);border-radius:12px 12px 0 0;padding:32px 40px;text-align:center;">
              <img src="https://ynpkkoqzenmctqrmtnxs.supabase.co/storage/v1/object/public/email-assets/logo.png" alt="Replay Club" width="180" style="display:block;margin:0 auto 16px;max-width:180px;height:auto;" />
              <p style="margin:8px 0 0;font-size:13px;color:#8a8a8a;letter-spacing:2px;text-transform:uppercase;">
                Complimentary Session
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:40px;border-left:1px solid #e5e5e5;border-right:1px solid #e5e5e5;">
              <p style="margin:0 0 24px;font-size:22px;font-weight:bold;color:#0a0a0a;font-family:'Space Grotesk',Arial,sans-serif;">
                Your Free Session Awaits 🎶
              </p>
              <p style="margin:0 0 32px;font-size:14px;color:#555555;line-height:1.6;">
                You've been invited to a complimentary <strong style="color:#0a0a0a;">${promo.room_title}</strong> session at Replay Club.
              </p>

              <!-- Code card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9f9f9;border-radius:8px;border:1px solid #eee;">
                <tr>
                  <td style="padding:28px;text-align:center;">
                    <p style="margin:0 0 8px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:2px;">
                      Your Redemption Code
                    </p>
                    <p style="margin:0;font-size:32px;font-weight:700;letter-spacing:6px;color:#0a0a0a;font-family:'Space Grotesk',Arial,sans-serif;">
                      ${promo.code}
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:28px 0 0;font-size:14px;color:#555555;line-height:1.6;">
                Sign in and enter this code on the redemption page to unlock your free session. This code is single-use.
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:28px 0 0;">
                    <a href="https://www.replayclub.io/promo/${promo.token}" style="display:inline-block;background-color:#0a0a0a;color:#f2f2f2;font-size:14px;font-weight:600;border-radius:8px;padding:14px 32px;text-decoration:none;text-transform:uppercase;letter-spacing:1.5px;font-family:'Space Grotesk',Arial,sans-serif;">
                      Sign In &amp; Redeem
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#0a0a0a;border-radius:0 0 12px 12px;padding:24px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#555;">
                © ${new Date().getFullYear()} Replay Club. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    };

    await supabase.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: emailPayload,
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
