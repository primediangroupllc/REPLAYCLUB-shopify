import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { resolveFromHeader, sendTwilioSms, resolveAdminPhones } from "../_shared/site-settings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function renderHtml(rental: {
  id: string;
  customer_name: string;
  items: string[];
  rental_days: number;
  amount_cents: number;
  pickup_date: string | null;
}): string {
  const amount = (rental.amount_cents / 100).toFixed(2);
  const pickup = rental.pickup_date || "TBD — coordinate with the studio";
  const itemsList = rental.items.map((i) => `<li style="padding:4px 0;color:#1a1a1a;">${i}</li>`).join("");
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>Rental Confirmed</title></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:'Inter',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr><td style="background:linear-gradient(135deg,#0a0a0a 0%,#1a1a1a 100%);border-radius:12px 12px 0 0;padding:32px 40px;text-align:center;">
          <img src="https://ynpkkoqzenmctqrmtnxs.supabase.co/storage/v1/object/public/email-assets/logo.png" alt="Replay Club" width="200" style="display:block;margin:0 auto 16px;max-width:200px;height:auto;" />
          <p style="margin:8px 0 0;font-size:13px;color:#8a8a8a;letter-spacing:2px;text-transform:uppercase;">Equipment Rental Confirmed</p>
        </td></tr>
        <tr><td style="background-color:#ffffff;padding:40px;border-left:1px solid #e5e5e5;border-right:1px solid #e5e5e5;">
          <p style="margin:0 0 24px;font-size:16px;color:#1a1a1a;line-height:1.6;">Hey ${rental.customer_name},</p>
          <p style="margin:0 0 24px;font-size:16px;color:#1a1a1a;line-height:1.6;">Your equipment rental is confirmed. Here are the details:</p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#0a0a0a 0%,#2a2a2a 100%);border-radius:8px;margin-bottom:24px;">
            <tr><td style="padding:24px;text-align:center;">
              <p style="margin:0 0 12px;font-size:11px;color:#8a8a8a;letter-spacing:2px;text-transform:uppercase;">Pickup QR</p>
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&data=${encodeURIComponent(`replayclub:checkin:${rental.id}`)}" alt="Pickup QR" width="220" height="220" style="display:block;margin:0 auto 12px;background:#ffffff;padding:12px;border-radius:8px;" />
              <p style="margin:0;font-size:11px;color:#8a8a8a;">Show this QR at pickup — staff will scan you in.</p>
            </td></tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9f9f9;border-radius:8px;border:1px solid #eee;">
            <tr><td style="padding:24px;">
              <p style="margin:0 0 12px;font-size:14px;color:#666;">📦 Equipment</p>
              <ul style="margin:0 0 16px 18px;padding:0;font-size:14px;">${itemsList}</ul>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="padding:8px 0;font-size:14px;color:#666;border-top:1px solid #eee;">📅 Pickup Date</td><td style="padding:8px 0;font-size:14px;color:#1a1a1a;font-weight:600;text-align:right;border-top:1px solid #eee;">${pickup}</td></tr>
                <tr><td style="padding:8px 0;font-size:14px;color:#666;border-top:1px solid #eee;">⏱️ Duration</td><td style="padding:8px 0;font-size:14px;color:#1a1a1a;font-weight:600;text-align:right;border-top:1px solid #eee;">${rental.rental_days} day${rental.rental_days > 1 ? "s" : ""}</td></tr>
                <tr><td style="padding:8px 0;font-size:14px;color:#666;border-top:1px solid #eee;">💰 Total</td><td style="padding:8px 0;font-size:14px;color:#1a1a1a;font-weight:600;text-align:right;border-top:1px solid #eee;">$${amount}</td></tr>
              </table>
            </td></tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9f9f9;border-radius:8px;border:1px solid #eee;margin-top:24px;">
            <tr><td style="padding:24px;">
              <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#1a1a1a;">📍 Pickup Point</p>
              <p style="margin:0 0 4px;font-size:14px;color:#333;"><strong>14521 Friar St, Van Nuys, CA 91411</strong></p>
              <a href="https://www.google.com/maps/search/?api=1&query=14521+Friar+St+Van+Nuys+CA+91411" style="display:inline-block;background-color:#111111;color:#ffffff;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:600;text-decoration:none;margin-top:12px;">📍 Open in Google Maps</a>
              <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
              <p style="margin:0 0 4px;font-size:14px;color:#333;">• Reply to this email or text us when you arrive.</p>
              <p style="margin:0 0 4px;font-size:14px;color:#333;">• <strong>Valid photo ID required</strong> matching the name on your rental.</p>
              <p style="margin:0 0 4px;font-size:14px;color:#333;">• You signed the rental agreement at checkout — equipment must be returned by the end of day on the final rental day.</p>
              <p style="margin:0;font-size:14px;color:#333;">• Questions? Email <a href="mailto:replayclubrecords@gmail.com" style="color:#1a1a1a;">replayclubrecords@gmail.com</a>.</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="background-color:#0a0a0a;border-radius:0 0 12px 12px;padding:24px 40px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#555;">© ${new Date().getFullYear()} Replay Club. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function renderText(rental: {
  id: string;
  customer_name: string;
  items: string[];
  rental_days: number;
  amount_cents: number;
  pickup_date: string | null;
}): string {
  const amount = (rental.amount_cents / 100).toFixed(2);
  return [
    `Hey ${rental.customer_name},`,
    "",
    "Your equipment rental is confirmed.",
    "",
    `Equipment: ${rental.items.join(", ")}`,
    `Pickup date: ${rental.pickup_date || "TBD — coordinate with the studio"}`,
    `Duration: ${rental.rental_days} day${rental.rental_days > 1 ? "s" : ""}`,
    `Total: $${amount}`,
    `Rental reference: ${rental.id}`,
    "",
    "PICKUP",
    "Show the QR code in this email at pickup — staff will scan you in.",
    "Location: 14521 Friar St, Van Nuys, CA 91411",
    "Maps: https://www.google.com/maps/search/?api=1&query=14521+Friar+St+Van+Nuys+CA+91411",
    "",
    "• Reply to this email or text us when you arrive.",
    "• Valid photo ID required matching the name on the rental.",
    "• Equipment must be returned by end of day on the final rental day.",
    "",
    "Questions? Contact replayclubrecords@gmail.com",
    "— Replay Club",
  ].join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const { rentalId } = await req.json();
    if (!rentalId) {
      return new Response(JSON.stringify({ error: "Missing rentalId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: rental, error: fetchErr } = await supabase
      .from("equipment_rentals")
      .select("*")
      .eq("id", rentalId)
      .single();

    if (fetchErr || !rental) {
      return new Response(JSON.stringify({ error: "Rental not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (rental.confirmation_sent) {
      return new Response(JSON.stringify({ skipped: true, reason: "already_sent" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const items = Array.isArray(rental.items) ? rental.items.map((i: unknown) => String(i)) : [];
    const html = renderHtml({ ...rental, items });
    const text = renderText({ ...rental, items });
    const messageId = `rental-confirm-${rental.id}`;

    const fromHeader = await resolveFromHeader(
      "booking_confirmation",
      "Replay Club",
      "notify.www.replayclub.io",
      "rentals",
    );
    const { error: enqueueErr } = await supabase.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        to: rental.customer_email,
        from: fromHeader,
        sender_domain: "notify.www.replayclub.io",
        subject: `✅ Rental Confirmed — ${items.slice(0, 2).join(", ")}${items.length > 2 ? ` +${items.length - 2}` : ""}`,
        html,
        text,
        purpose: "transactional",
        label: "rental-confirmation",
        idempotency_key: messageId,
        queued_at: new Date().toISOString(),
      },
    });

    if (enqueueErr) throw new Error(`Enqueue error: ${enqueueErr.message}`);

    await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: "rental-confirmation",
      recipient_email: rental.customer_email,
      status: "pending",
    });

    await supabase
      .from("equipment_rentals")
      .update({ confirmation_sent: true })
      .eq("id", rentalId);

    // Admin SMS notification
    try {
      const amount = (rental.amount_cents / 100).toFixed(2);
      const smsBody = `📦 New Rental!\n${rental.customer_name}\n${items.join(", ")}\n${rental.rental_days}d / $${amount}`;
      await sendTwilioSms(resolveAdminPhones(), smsBody);
    } catch (smsErr) {
      console.error("Admin SMS for rental failed", smsErr);
    }

    return new Response(JSON.stringify({ success: true, messageId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-rental-confirmation error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});