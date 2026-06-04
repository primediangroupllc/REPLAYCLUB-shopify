import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { resolveAdminEmails, sendTwilioSms, resolveAdminPhones } from "../_shared/site-settings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildGoogleCalendarUrl(
  title: string,
  date: string,
  time: string,
  description: string,
): string {
  const datePart = date.replace(/-/g, '');
  const timeMatch = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  let startHour = 14, startMin = 0;
  if (timeMatch) {
    startHour = parseInt(timeMatch[1], 10);
    startMin = parseInt(timeMatch[2], 10);
    const isPM = timeMatch[3].toUpperCase() === 'PM';
    if (isPM && startHour !== 12) startHour += 12;
    if (!isPM && startHour === 12) startHour = 0;
  }
  const totalEnd = startHour * 60 + startMin + 90;
  const endHour = Math.floor(totalEnd / 60);
  const endMin = totalEnd % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  const startISO = `${datePart}T${pad(startHour)}${pad(startMin)}00`;
  const endISO = `${datePart}T${pad(endHour)}${pad(endMin)}00`;
  const location = encodeURIComponent('Replay Club — Pickup point: 14521 Friar St, Van Nuys, CA 91411 (escort will walk you to the studio)');
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startISO}/${endISO}&details=${encodeURIComponent(description)}&location=${location}`;
}

function renderBookingEmail(booking: {
  id: string;
  customer_name: string;
  room_title: string;
  booking_date: string;
  booking_time: string;
  amount_cents: number;
  tier: string | null;
  equipment: unknown[] | null;
  lighting: string | null;
  sound: string | null;
  layout: string | null;
}): string {
  const amount = (booking.amount_cents / 100).toFixed(2);
  const extras: string[] = [];
  if (booking.tier) extras.push(`<strong>Tier:</strong> ${booking.tier}`);
  if (booking.lighting) extras.push(`<strong>Lighting:</strong> ${booking.lighting}`);
  if (booking.sound) extras.push(`<strong>Sound:</strong> ${booking.sound}`);
  if (booking.layout) extras.push(`<strong>Layout:</strong> ${booking.layout}`);
  if (Array.isArray(booking.equipment) && booking.equipment.length > 0) {
    extras.push(`<strong>Equipment:</strong> ${booking.equipment.join(", ")}`);
  }

  const calUrl = buildGoogleCalendarUrl(
    `Replay Club – ${booking.room_title} Session`,
    booking.booking_date,
    booking.booking_time,
    `Session at Replay Club\nRoom: ${booking.room_title}\nTotal: $${amount}`,
  );

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Booking Confirmed</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:'Inter',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0a0a0a 0%,#1a1a1a 100%);border-radius:12px 12px 0 0;padding:32px 40px;text-align:center;">
              <img src="https://ynpkkoqzenmctqrmtnxs.supabase.co/storage/v1/object/public/email-assets/logo.png" alt="Replay Club" width="200" style="display:block;margin:0 auto 16px;max-width:200px;height:auto;" />
              <p style="margin:8px 0 0;font-size:13px;color:#8a8a8a;letter-spacing:2px;text-transform:uppercase;">
                Booking Confirmed
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:40px;border-left:1px solid #e5e5e5;border-right:1px solid #e5e5e5;">
              <p style="margin:0 0 24px;font-size:16px;color:#1a1a1a;line-height:1.6;">
                Hey ${booking.customer_name},
              </p>
              <p style="margin:0 0 24px;font-size:16px;color:#1a1a1a;line-height:1.6;">
                Your session is locked in. Here are the details:
              </p>

              <!-- Check-in QR card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#0a0a0a 0%,#2a2a2a 100%);border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:24px;text-align:center;">
                    <p style="margin:0 0 12px;font-size:11px;color:#8a8a8a;letter-spacing:2px;text-transform:uppercase;">Check-In QR</p>
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&data=${encodeURIComponent(`replayclub:checkin:${booking.id}`)}" alt="Check-in QR" width="220" height="220" style="display:block;margin:0 auto 12px;background:#ffffff;padding:12px;border-radius:8px;" />
                    <p style="margin:0;font-size:11px;color:#8a8a8a;">Show this QR at the studio entrance — staff will scan you in.</p>
                  </td>
                </tr>
              </table>

              <!-- Details card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9f9f9;border-radius:8px;border:1px solid #eee;">
                <tr>
                  <td style="padding:24px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:8px 0;font-size:14px;color:#666;">🎵 Room</td>
                        <td style="padding:8px 0;font-size:14px;color:#1a1a1a;font-weight:600;text-align:right;">
                          ${booking.room_title}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;font-size:14px;color:#666;border-top:1px solid #eee;">📅 Date</td>
                        <td style="padding:8px 0;font-size:14px;color:#1a1a1a;font-weight:600;text-align:right;border-top:1px solid #eee;">
                          ${booking.booking_date}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;font-size:14px;color:#666;border-top:1px solid #eee;">🕐 Time</td>
                        <td style="padding:8px 0;font-size:14px;color:#1a1a1a;font-weight:600;text-align:right;border-top:1px solid #eee;">
                          ${booking.booking_time}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;font-size:14px;color:#666;border-top:1px solid #eee;">💰 Total</td>
                        <td style="padding:8px 0;font-size:14px;color:#1a1a1a;font-weight:600;text-align:right;border-top:1px solid #eee;">
                          $${amount}
                        </td>
                      </tr>
                      ${extras.length > 0 ? extras.map(e => `
                      <tr>
                        <td colspan="2" style="padding:8px 0;font-size:13px;color:#555;border-top:1px solid #eee;">
                          ${e}
                        </td>
                      </tr>`).join("") : ""}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Google Calendar -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
                <tr>
                  <td align="center">
                    <a href="${calUrl}" style="display:inline-block;background-color:#1a73e8;color:#ffffff;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:600;text-decoration:none;">📅 Add to Google Calendar</a>
                  </td>
                </tr>
              </table>

              <!-- Location & Info -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9f9f9;border-radius:8px;border:1px solid #eee;margin-top:24px;">
                <tr>
                  <td style="padding:24px;">
                    <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#1a1a1a;">📍 Pickup Point</p>
                    <p style="margin:0 0 12px;font-size:14px;color:#333;">Replay Club is a private studio. Meet your escort at the pickup point below — they'll walk you to the studio entrance.</p>
                    <p style="margin:0 0 4px;font-size:14px;color:#333;"><strong>14521 Friar St</strong></p>
                    <p style="margin:0 0 4px;font-size:14px;color:#333;">Van Nuys, CA 91411</p>
                    <p style="margin:0 0 16px;font-size:14px;color:#333;">United States</p>
                    <a href="https://www.google.com/maps/search/?api=1&query=14521+Friar+St+Van+Nuys+CA+91411" style="display:inline-block;background-color:#111111;color:#ffffff;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:600;text-decoration:none;">📍 Open in Google Maps</a>
                    <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
                    <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#1a1a1a;">⚠️ Important Info</p>
                    <p style="margin:0 0 4px;font-size:14px;color:#333;">• When you arrive, reply to this email or text the studio number so we know you're here.</p>
                    <p style="margin:0 0 4px;font-size:14px;color:#333;">• An escort will meet you within a few minutes and walk you to the studio entrance.</p>
                    <p style="margin:0 0 4px;font-size:14px;color:#333;">• Please do not share the pickup point or studio location publicly — address confidentiality is part of our entry terms.</p>
                    <p style="margin:0 0 4px;font-size:14px;color:#333;">• <strong>Valid photo ID is required</strong> matching the name on your booking.</p>
                    <p style="margin:0;font-size:14px;color:#333;">• Please arrive 5–10 minutes before your start time.</p>
                  </td>
                </tr>
              </table>

              <p style="margin:32px 0 0;font-size:14px;color:#888;line-height:1.6;text-align:center;">
                See you at the studio! 🎶
              </p>
              <p style="margin:24px 0 0;font-size:13px;color:#888;line-height:1.6;text-align:center;">
                Here's what happens next: <a href="https://replayclub.io/how-it-works" style="color:#1a1a1a;text-decoration:underline;">How It Works</a>
              </p>
              <p style="margin:24px 0 0;font-size:13px;color:#888;line-height:1.6;text-align:center;">
                A reminder of our policies: <a href="https://replayclub.io/policies" style="color:#1a1a1a;text-decoration:underline;">Studio Policies</a> · <a href="https://replayclub.io/cancellation" style="color:#1a1a1a;text-decoration:underline;">Cancellation Policy</a>
              </p>
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
</html>`;
}

function renderBookingText(booking: {
  id: string;
  customer_name: string;
  room_title: string;
  booking_date: string;
  booking_time: string;
  amount_cents: number;
  tier: string | null;
  equipment: unknown[] | null;
  lighting: string | null;
  sound: string | null;
  layout: string | null;
}): string {
  const amount = (booking.amount_cents / 100).toFixed(2);
  const lines = [
    `Hey ${booking.customer_name},`,
    "",
    "Your session is locked in. Here are the details:",
    "",
    `Room: ${booking.room_title}`,
    `Date: ${booking.booking_date}`,
    `Time: ${booking.booking_time}`,
    `Total: $${amount}`,
  ];
  if (booking.tier) lines.push(`Tier: ${booking.tier}`);
  if (booking.lighting) lines.push(`Lighting: ${booking.lighting}`);
  if (booking.sound) lines.push(`Sound: ${booking.sound}`);
  if (booking.layout) lines.push(`Layout: ${booking.layout}`);
  if (Array.isArray(booking.equipment) && booking.equipment.length > 0) {
    lines.push(`Equipment: ${booking.equipment.join(", ")}`);
  }
  lines.push(
    "",
    "CHECK-IN",
    "Show the QR code in this email at the studio entrance — staff will scan you in.",
    `Booking reference: ${booking.id}`,
    "",
    "PICKUP POINT",
    "Replay Club is a private studio. Meet your escort at the pickup point — they'll walk you to the studio entrance.",
    "14521 Friar St, Van Nuys, CA 91411, United States",
    "Maps: https://www.google.com/maps/search/?api=1&query=14521+Friar+St+Van+Nuys+CA+91411",
    "",
    "IMPORTANT",
    "• When you arrive, reply to this email or text the studio number so we know you're here.",
    "• An escort will meet you within a few minutes.",
    "• Please do not share the pickup point or studio location publicly.",
    "• Valid photo ID is required matching the name on your booking.",
    "• Please arrive 5–10 minutes before your start time.",
    "",
    "Questions? Reply to this email or contact replayclubrecords@gmail.com.",
    "",
    "See you at the studio!",
    "— Replay Club",
  );
  return lines.join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookingId } = await req.json();
    if (!bookingId) {
      return new Response(JSON.stringify({ error: "Missing bookingId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch booking
    const { data: booking, error: fetchErr } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .single();

    if (fetchErr || !booking) {
      return new Response(JSON.stringify({ error: "Booking not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (booking.confirmation_sent) {
      return new Response(JSON.stringify({ skipped: true, reason: "already_sent" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send user confirmation via the standard transactional pipeline so the
    // unsubscribe_token + suppression handling are applied automatically.
    // (Previous custom enqueue path failed with "missing_unsubscribe".)
    const equipmentList = Array.isArray(booking.equipment) && booking.equipment.length > 0
      ? (booking.equipment as unknown[]).join(", ")
      : "";
    const { error: userSendErr } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "booking-confirmation",
        recipientEmail: booking.customer_email,
        idempotencyKey: `booking-confirm-${booking.id}`,
        templateData: {
          bookingId: booking.id,
          customerName: booking.customer_name,
          roomTitle: booking.room_title,
          bookingDate: booking.booking_date,
          bookingTime: booking.booking_time,
          amountFormatted: `$${(booking.amount_cents / 100).toFixed(2)}`,
          tier: booking.tier || "",
          layout: booking.layout || "",
          lighting: booking.lighting || "",
          sound: booking.sound || "",
          equipment: equipmentList,
        },
      },
    });
    if (userSendErr) {
      console.error("Failed to send user booking confirmation", userSendErr);
      throw new Error(`User confirmation send failed: ${userSendErr.message}`);
    }

    // Mark confirmation as sent
    await supabase
      .from("bookings")
      .update({ confirmation_sent: true })
      .eq("id", bookingId);

    // Send admin notification with Google Calendar link
    try {
      const adminEmails = await resolveAdminEmails("replayclubrecords@gmail.com");
      await Promise.all(adminEmails.map((adminEmail) =>
        supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "booking-notification-admin",
            recipientEmail: adminEmail,
            idempotencyKey: `booking-admin-${booking.id}-${adminEmail}`,
            templateData: {
              customerName: booking.customer_name,
              customerEmail: booking.customer_email,
              customerPhone: booking.customer_phone || "",
              roomTitle: booking.room_title,
              bookingDate: booking.booking_date,
              bookingTime: booking.booking_time,
              amountFormatted: `$${(booking.amount_cents / 100).toFixed(2)}`,
              tier: booking.tier || "",
              equipment: equipmentList,
              consentAccepted: !!booking.consent_accepted,
              consentAcceptedAt: booking.consent_accepted_at || "",
              consentVersion: booking.consent_version || "",
            },
          },
        })
      ));
    } catch (adminErr) {
      console.error("Failed to send admin notification email", adminErr);
    }

    // Send SMS notification to admin
    try {
      const amount = (booking.amount_cents / 100).toFixed(2);
      const smsBody = `🎵 New Booking!\n${booking.customer_name}\n${booking.room_title}\n${booking.booking_date} @ ${booking.booking_time}\n$${amount}`;
      await sendTwilioSms(resolveAdminPhones(), smsBody);
    } catch (smsErr) {
      console.error("Failed to send admin SMS notification", smsErr);
    }

    return new Response(JSON.stringify({ success: true, messageId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
