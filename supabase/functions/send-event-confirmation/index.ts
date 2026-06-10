import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { resolveFromHeader } from "../_shared/site-settings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOCATION = "Replay Club — Pickup point: 14521 Friar St, Van Nuys, CA 91411 (escort will walk you to the studio)";

function buildGoogleCalendarUrl(opts: {
  title: string;
  date: string;
  startTime: string;
  endTime?: string | null;
  description?: string;
}): string {
  const datePart = opts.date.replace(/-/g, "");
  const parseTime = (t: string): { h: number; m: number } => {
    const m = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!m) return { h: 19, m: 0 };
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ampm = m[3]?.toUpperCase();
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return { h, m: min };
  };
  const start = parseTime(opts.startTime);
  const end = opts.endTime
    ? parseTime(opts.endTime)
    : { h: (start.h + 2) % 24, m: start.m };
  const pad = (n: number) => n.toString().padStart(2, "0");
  const startISO = `${datePart}T${pad(start.h)}${pad(start.m)}00`;
  const endISO = `${datePart}T${pad(end.h)}${pad(end.m)}00`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(opts.title)}&dates=${startISO}/${endISO}&details=${encodeURIComponent(opts.description || "")}&location=${encodeURIComponent(LOCATION)}`;
}

function buildIcs(opts: {
  uid: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime?: string | null;
}): string {
  const datePart = opts.date.replace(/-/g, "");
  const parseTime = (t: string): { h: number; m: number } => {
    const m = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!m) return { h: 19, m: 0 };
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ampm = m[3]?.toUpperCase();
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return { h, m: min };
  };
  const start = parseTime(opts.startTime);
  const end = opts.endTime
    ? parseTime(opts.endTime)
    : { h: (start.h + 2) % 24, m: start.m };
  const pad = (n: number) => n.toString().padStart(2, "0");
  // Pacific time — TZID is included in DTSTART
  const dtStart = `${datePart}T${pad(start.h)}${pad(start.m)}00`;
  const dtEnd = `${datePart}T${pad(end.h)}${pad(end.m)}00`;
  const dtStamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const escapeText = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Replay Club//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VTIMEZONE",
    "TZID:America/Los_Angeles",
    "BEGIN:STANDARD",
    "DTSTART:19701101T020000",
    "TZOFFSETFROM:-0700",
    "TZOFFSETTO:-0800",
    "TZNAME:PST",
    "RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=11",
    "END:STANDARD",
    "BEGIN:DAYLIGHT",
    "DTSTART:19700308T020000",
    "TZOFFSETFROM:-0800",
    "TZOFFSETTO:-0700",
    "TZNAME:PDT",
    "RRULE:FREQ=YEARLY;BYDAY=2SU;BYMONTH=3",
    "END:DAYLIGHT",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:${opts.uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;TZID=America/Los_Angeles:${dtStart}`,
    `DTEND;TZID=America/Los_Angeles:${dtEnd}`,
    `SUMMARY:${escapeText(opts.title)}`,
    `DESCRIPTION:${escapeText(opts.description)}`,
    `LOCATION:${escapeText(LOCATION)}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function renderHtml(args: {
  mode: "confirmation" | "waitlist_open" | "promoted";
  customerName: string;
  event: {
    id: string;
    title: string;
    description: string | null;
    event_date: string;
    start_time: string;
    end_time: string | null;
    room_title: string | null;
    price_cents: number;
    cover_image_url: string | null;
    refund_policy: string | null;
  };
  ticketCode: string | null;
  amountPaidCents: number;
  origin: string;
}): string {
  const { mode, customerName, event, ticketCode, amountPaidCents, origin } = args;

  const calUrl = buildGoogleCalendarUrl({
    title: `Replay Club — ${event.title}`,
    date: event.event_date,
    startTime: event.start_time,
    endTime: event.end_time,
    description: event.description || "",
  });

  const heading =
    mode === "promoted"
      ? "🎉 You're in! A spot just opened up."
      : mode === "waitlist_open"
        ? "🚨 A spot just opened — claim it now"
        : "✅ Your spot is locked in";

  const tagline =
    mode === "promoted"
      ? "You moved off the waitlist — see you there."
      : mode === "waitlist_open"
        ? "Pay within 24 hours to confirm your ticket. After that, we'll roll the spot to the next person."
        : event.price_cents > 0
          ? "Your ticket is confirmed."
          : "Your RSVP is confirmed.";

  const ctaButton =
    mode === "waitlist_open"
      ? `<a href="${origin}/events/${event.id}" style="display:inline-block;background-color:#1a73e8;color:#ffffff;padding:14px 28px;border-radius:6px;font-size:15px;font-weight:600;text-decoration:none;">Claim my spot</a>`
      : `<a href="${calUrl}" style="display:inline-block;background-color:#1a73e8;color:#ffffff;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:600;text-decoration:none;">📅 Add to Google Calendar</a>`;

  const qrUrl = ticketCode
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(ticketCode)}`
    : "";

  const ticketBlock =
    ticketCode && mode !== "waitlist_open"
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#0a0a0a 0%,#2a2a2a 100%);border-radius:8px;margin-bottom:24px;">
          <tr><td style="padding:24px;text-align:center;">
            <p style="margin:0 0 12px;font-size:11px;color:#8a8a8a;letter-spacing:2px;text-transform:uppercase;">Your Ticket</p>
            <img src="${qrUrl}" alt="Ticket QR code" width="200" height="200" style="display:block;margin:0 auto 16px;background:#ffffff;padding:12px;border-radius:8px;" />
            <p style="margin:0 0 6px;font-size:24px;font-weight:bold;color:#ffffff;letter-spacing:6px;font-family:'Space Grotesk',monospace;">${ticketCode}</p>
            <p style="margin:0;font-size:11px;color:#8a8a8a;">Scan at the door for instant check-in</p>
          </td></tr></table>`
      : "";

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>${event.title}</title></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:'Inter',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr><td style="background:linear-gradient(135deg,#0a0a0a 0%,#1a1a1a 100%);border-radius:12px 12px 0 0;padding:32px 40px;text-align:center;">
          <img src="https://ynpkkoqzenmctqrmtnxs.supabase.co/storage/v1/object/public/email-assets/logo.png" alt="Replay Club" width="200" style="display:block;margin:0 auto 16px;max-width:200px;height:auto;" />
          <p style="margin:8px 0 0;font-size:13px;color:#8a8a8a;letter-spacing:2px;text-transform:uppercase;">Members Event</p>
        </td></tr>
        <tr><td style="background-color:#ffffff;padding:40px;border-left:1px solid #e5e5e5;border-right:1px solid #e5e5e5;">
          <h1 style="margin:0 0 12px;font-size:22px;color:#0a0a0a;line-height:1.3;">${heading}</h1>
          <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6;">Hey ${customerName},</p>
          <p style="margin:0 0 24px;font-size:15px;color:#333;line-height:1.6;">${tagline}</p>
          ${ticketBlock}
          ${event.cover_image_url ? `<img src="${event.cover_image_url}" alt="${event.title}" style="width:100%;border-radius:8px;margin-bottom:20px;" />` : ""}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9f9f9;border-radius:8px;border:1px solid #eee;">
            <tr><td style="padding:24px;">
              <p style="margin:0 0 12px;font-size:18px;font-weight:700;color:#0a0a0a;">${event.title}</p>
              ${event.description ? `<p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6;">${event.description}</p>` : ""}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="padding:8px 0;font-size:14px;color:#666;">📅 Date</td><td style="padding:8px 0;font-size:14px;color:#1a1a1a;font-weight:600;text-align:right;">${event.event_date}</td></tr>
                <tr><td style="padding:8px 0;font-size:14px;color:#666;border-top:1px solid #eee;">🕐 Time</td><td style="padding:8px 0;font-size:14px;color:#1a1a1a;font-weight:600;text-align:right;border-top:1px solid #eee;">${event.start_time}${event.end_time ? ` – ${event.end_time}` : ""}</td></tr>
                ${event.room_title ? `<tr><td style="padding:8px 0;font-size:14px;color:#666;border-top:1px solid #eee;">🏛️ Room</td><td style="padding:8px 0;font-size:14px;color:#1a1a1a;font-weight:600;text-align:right;border-top:1px solid #eee;">${event.room_title}</td></tr>` : ""}
                ${amountPaidCents > 0 ? `<tr><td style="padding:8px 0;font-size:14px;color:#666;border-top:1px solid #eee;">💰 Paid</td><td style="padding:8px 0;font-size:14px;color:#1a1a1a;font-weight:600;text-align:right;border-top:1px solid #eee;">$${(amountPaidCents / 100).toFixed(2)}</td></tr>` : ""}
              </table>
            </td></tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;"><tr><td align="center">${ctaButton}</td></tr></table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9f9f9;border-radius:8px;border:1px solid #eee;margin-top:24px;">
            <tr><td style="padding:24px;">
              <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#1a1a1a;">📍 Pickup Point</p>
              <p style="margin:0 0 12px;font-size:14px;color:#333;">Replay Club is a private venue. Meet our team at the pickup point below — we'll walk you to the entrance.</p>
              <p style="margin:0 0 4px;font-size:14px;color:#333;"><strong>14521 Friar St, Van Nuys, CA 91411</strong></p>
              <a href="https://www.google.com/maps/search/?api=1&query=14521+Friar+St+Van+Nuys+CA+91411" style="display:inline-block;background-color:#111111;color:#ffffff;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:600;text-decoration:none;margin-top:12px;">📍 Open in Google Maps</a>
              <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
              <p style="margin:0 0 4px;font-size:14px;color:#333;">• Reply to this email or text the venue number when you arrive</p>
              <p style="margin:0 0 4px;font-size:14px;color:#333;">• Please do not share the pickup point or venue location publicly</p>
              <p style="margin:0 0 4px;font-size:14px;color:#333;">• <strong>Valid photo ID required</strong></p>
              <p style="margin:0;font-size:14px;color:#333;">• A calendar invite (.ics) is attached to this email</p>
            </td></tr>
          </table>
          ${event.refund_policy ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9f9f9;border-radius:8px;border:1px solid #eee;margin-top:24px;">
            <tr><td style="padding:24px;">
              <p style="margin:0 0 12px;font-size:11px;color:#8a8a8a;letter-spacing:2px;text-transform:uppercase;font-weight:600;">Refund Policy</p>
              <p style="margin:0;font-size:13px;color:#444;line-height:1.6;white-space:pre-wrap;">${event.refund_policy.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!))}</p>
            </td></tr>
          </table>` : ""}
        </td></tr>
        <tr><td style="background-color:#0a0a0a;border-radius:0 0 12px 12px;padding:24px 40px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#555;">© ${new Date().getFullYear()} Replay Club. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function renderText(args: {
  mode: "confirmation" | "waitlist_open" | "promoted";
  customerName: string;
  event: {
    id: string;
    title: string;
    description: string | null;
    event_date: string;
    start_time: string;
    end_time: string | null;
    room_title: string | null;
    price_cents: number;
    refund_policy: string | null;
  };
  ticketCode: string | null;
  amountPaidCents: number;
  origin: string;
}): string {
  const { mode, customerName, event, ticketCode, amountPaidCents, origin } = args;
  const heading =
    mode === "promoted"
      ? "You're in! A spot just opened up."
      : mode === "waitlist_open"
        ? "A spot just opened — claim it now."
        : "Your spot is locked in.";
  const tagline =
    mode === "waitlist_open"
      ? `Pay within 24 hours to confirm your ticket: ${origin}/events/${event.id}`
      : event.price_cents > 0
        ? "Your ticket is confirmed."
        : "Your RSVP is confirmed.";
  const lines = [
    heading,
    "",
    `Hey ${customerName},`,
    tagline,
    "",
    event.title,
  ];
  if (event.description) lines.push(event.description, "");
  lines.push(
    `Date: ${event.event_date}`,
    `Time: ${event.start_time}${event.end_time ? ` – ${event.end_time}` : ""}`,
  );
  if (event.room_title) lines.push(`Room: ${event.room_title}`);
  if (amountPaidCents > 0) lines.push(`Paid: $${(amountPaidCents / 100).toFixed(2)}`);
  if (ticketCode && mode !== "waitlist_open") {
    lines.push("", `Ticket code: ${ticketCode}`, "Scan the QR code in this email at the door for instant check-in.");
  }
  lines.push(
    "",
    "PICKUP POINT",
    "Replay Club is a private venue. Meet our team at 14521 Friar St, Van Nuys, CA 91411 — we'll walk you to the entrance.",
    "Maps: https://www.google.com/maps/search/?api=1&query=14521+Friar+St+Van+Nuys+CA+91411",
    "",
    "• Reply to this email or text the venue number when you arrive",
    "• Please do not share the pickup point or venue location publicly",
    "• Valid photo ID required",
    "• A calendar invite (.ics) is attached to this email",
    "",
  );
  if (event.refund_policy) {
    lines.push("REFUND POLICY", event.refund_policy, "");
  }
  lines.push("Questions? Contact replayclubrecords@gmail.com", "— Replay Club");
  return lines.join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const body = await req.json();
    const rsvpId = body.rsvpId as string | undefined;
    const mode = (body.mode as "confirmation" | "waitlist_open" | "promoted" | undefined) ||
      "confirmation";
    if (!rsvpId) {
      return new Response(JSON.stringify({ error: "Missing rsvpId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: rsvp, error: rErr } = await supabase
      .from("event_rsvps")
      .select("*, events(*)")
      .eq("id", rsvpId)
      .single();

    if (rErr || !rsvp) {
      return new Response(JSON.stringify({ error: "RSVP not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event = rsvp.events as {
      id: string;
      title: string;
      description: string | null;
      event_date: string;
      start_time: string;
      end_time: string | null;
      room_title: string | null;
      price_cents: number;
      cover_image_url: string | null;
      refund_policy: string | null;
    };

    const origin = req.headers.get("origin") || "https://www.replayclub.io";

    const html = renderHtml({
      mode,
      customerName: rsvp.user_name,
      event,
      ticketCode: rsvp.ticket_code,
      amountPaidCents: rsvp.amount_paid_cents,
      origin,
    });

    const text = renderText({
      mode,
      customerName: rsvp.user_name,
      event,
      ticketCode: rsvp.ticket_code,
      amountPaidCents: rsvp.amount_paid_cents,
      origin,
    });

    const ics = buildIcs({
      uid: `event-${event.id}-rsvp-${rsvp.id}@replayclub.io`,
      title: `Replay Club — ${event.title}`,
      description: event.description || "",
      date: event.event_date,
      startTime: event.start_time,
      endTime: event.end_time,
    });

    const subjectByMode: Record<string, string> = {
      confirmation: `🎶 You're in — ${event.title}`,
      promoted: `🎉 Spot opened — you're confirmed for ${event.title}`,
      waitlist_open: `🚨 Claim your spot — ${event.title}`,
    };

    const messageId = `event-${mode}-${rsvp.id}-${Date.now()}`;

    const fromHeader = await resolveFromHeader(
      "booking_confirmation",
      "Replay Club",
      "replayclub.io",
      "events",
    );
    const { error: enqueueErr } = await supabase.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        to: rsvp.user_email,
        from: fromHeader,
        sender_domain: "replayclub.io",
        subject: subjectByMode[mode],
        html,
        text,
        attachments: [
          {
            filename: "event.ics",
            content: btoa(ics),
            content_type: "text/calendar; charset=utf-8; method=PUBLISH",
          },
        ],
        purpose: "transactional",
        label: `event-${mode}`,
        idempotency_key: messageId,
        queued_at: new Date().toISOString(),
      },
    });

    if (enqueueErr) throw new Error(`Enqueue error: ${enqueueErr.message}`);

    await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: `event-${mode}`,
      recipient_email: rsvp.user_email,
      status: "pending",
    });

    return new Response(JSON.stringify({ success: true, messageId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-event-confirmation error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
