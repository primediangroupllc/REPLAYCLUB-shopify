import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.3";
import { resolveAdminEmails, sendTwilioSms, resolveAdminPhones } from "../_shared/site-settings.ts";
import { parseBookingDateTime, normalizeBookingTime, bookingTimeToMinutes } from "../_shared/bookingTime.ts";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { booking_id, new_date, new_time } = await req.json();
    if (!booking_id || !new_date || !new_time) {
      return new Response(JSON.stringify({ error: "booking_id, new_date, and new_time are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch booking
    const { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select("id, customer_email, customer_name, payment_status, booking_date, booking_time, room_title")
      .eq("id", booking_id)
      .single();

    if (fetchError || !booking) {
      return new Response(JSON.stringify({ error: "Booking not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (booking.customer_email !== user.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (booking.payment_status === "cancelled") {
      return new Response(JSON.stringify({ error: "Cannot reschedule a cancelled booking" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (booking.payment_status !== "paid" && booking.payment_status !== "promo") {
      return new Response(JSON.stringify({ error: "Only paid or promo bookings can be rescheduled" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enforce 24-hour policy
    const bookingDateTime = parseBookingDateTime(booking.booking_date, booking.booking_time);
    const now = new Date();
    const hoursUntil = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntil < 24) {
      return new Response(JSON.stringify({ error: "Rescheduling requires at least 24 hours notice before your session" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const oldDate = booking.booking_date;
    const oldTime = booking.booking_time;

    // ── Validate the requested new slot BEFORE writing ──────────────────────
    // Historically this did a blind UPDATE with zero availability checks, so a
    // free-text <input type="time"> (which emits 24h "14:30") could (1) be
    // stored verbatim — a format the AM/PM slot/conflict math can't read
    // (slotToMin → -1), making the row invisible to future conflict checks; or
    // (2) land off the hourly grid (e.g. 2:30) / outside hours / overlapping an
    // existing booking without tripping the exact-match unique index. So:
    // normalize → grid + hours → re-check 24h vs the NEW slot → SAME
    // buffer-overlap conflict check as the main flow → only then commit.
    const normalizedTime = normalizeBookingTime(new_time);
    if (!normalizedTime) {
      return new Response(JSON.stringify({ error: "Invalid time. Please pick a valid session time." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const roomTitle = booking.room_title as string;
    // Equipment Rental is day-based, not time-slotted (getTimeSlotsForRoom → []).
    const isTimeSlottedRoom = roomTitle !== "Equipment Rental";
    const reqMin = bookingTimeToMinutes(normalizedTime)!; // non-null: normalized above

    if (isTimeSlottedRoom) {
      // Operating hours: studio open 10:00 AM (600). Last start = 9:00 PM (1260)
      // for the 1-hour Livestream room, else 8:00 PM (1200) for the
      // 2-hour-minimum rooms. Slots are on the hour. Keep in lock-step with
      // getTimeSlotsForRoom() in src/lib/bookingTimeSlots.ts.
      const OPEN_MIN = 10 * 60;
      const lastStartMin = roomTitle === "Livestream" ? 21 * 60 : 20 * 60;
      if (reqMin % 60 !== 0 || reqMin < OPEN_MIN || reqMin > lastStartMin) {
        return new Response(JSON.stringify({ error: "That isn't a bookable slot. Pick an on-the-hour time within studio hours." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // The NEW slot itself must be ≥24h out — the earlier check only covered the
    // old booking, so you could otherwise move into a <24h (or past) slot.
    const newDateTime = parseBookingDateTime(new_date, normalizedTime);
    const hoursUntilNew = (newDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (isNaN(hoursUntilNew) || hoursUntilNew < 24) {
      return new Response(JSON.stringify({ error: "Pick a new time at least 24 hours from now." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Conflict check — buffer-overlap math is BYTE-IDENTICAL to the main booking
    // flow (create-booking-payment/index.ts). The only deltas are required for
    // reschedule: query the NEW date and exclude this booking's own row
    // (.neq id). Daily-cap is intentionally out of scope (capacity, not a
    // double-booking; a self-move nets zero on its original date).
    if (isTimeSlottedRoom) {
      const { data: settingsRows } = await supabase.rpc("get_booking_density_settings");
      const settings = Array.isArray(settingsRows) ? settingsRows[0] : settingsRows;
      const bufferMinutes: number = settings?.booking_buffer_minutes ?? 30;
      const sharedPool: boolean = settings?.shared_room_pool ?? true;

      const slotToMin = (s: string): number => {
        const m = s?.match?.(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (!m) return -1;
        let h = parseInt(m[1], 10) % 12;
        if (m[3].toUpperCase() === "PM") h += 12;
        return h * 60 + parseInt(m[2], 10);
      };
      const reqSlotMin = slotToMin(normalizedTime);
      if (reqSlotMin >= 0) {
        const dayBookingsQuery = supabase
          .from("bookings")
          .select("id, booking_time, room_title")
          .eq("booking_date", new_date)
          .in("payment_status", ["paid", "promo"])
          .neq("id", booking_id);
        if (!sharedPool) dayBookingsQuery.eq("room_title", roomTitle);
        const { data: dayBookings } = await dayBookingsQuery;
        const ASSUMED_BOOKING_MINUTES = 60;
        const SLOT_LENGTH_MINUTES = 60;
        const buffer = Math.max(0, bufferMinutes);
        const reqEnd = reqSlotMin + SLOT_LENGTH_MINUTES;
        const conflict = (dayBookings || []).some((b: { booking_time: string }) => {
          const start = slotToMin(b.booking_time);
          if (start < 0) return false;
          const end = start + ASSUMED_BOOKING_MINUTES + buffer;
          return reqEnd > start && reqSlotMin < end;
        });
        if (conflict) {
          return new Response(JSON.stringify({ error: "That slot conflicts with an existing booking or its buffer. Please pick another time." }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Update booking — store the canonical AM/PM form, never the raw 24h input.
    const { error: updateError } = await supabase
      .from("bookings")
      .update({ booking_date: new_date, booking_time: normalizedTime })
      .eq("id", booking_id);

    if (updateError) {
      return new Response(JSON.stringify({ error: "Failed to reschedule" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Remove existing reminder so a new one can be sent
    await supabase.from("booking_reminders").delete().eq("booking_id", booking_id);

    // Send reschedule confirmation email
    await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "booking-rescheduled",
        recipientEmail: booking.customer_email,
        idempotencyKey: `reschedule-${booking_id}-${new_date}-${normalizedTime}`,
        templateData: {
          customerName: booking.customer_name,
          roomTitle: booking.room_title,
          oldDate,
          oldTime,
          newDate: new_date,
          newTime: normalizedTime,
        },
      },
    });

    // Send admin notification
    try {
      const adminEmails = await resolveAdminEmails("replayclubrecords@gmail.com");
      await Promise.all(adminEmails.map((adminEmail) =>
        supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "reschedule-notification-admin",
            recipientEmail: adminEmail,
            idempotencyKey: `reschedule-admin-${booking_id}-${new_date}-${normalizedTime}-${adminEmail}`,
            templateData: {
              customerName: booking.customer_name,
              customerEmail: booking.customer_email,
              roomTitle: booking.room_title,
              oldDate,
              oldTime,
              newDate: new_date,
              newTime: normalizedTime,
            },
          },
        })
      ));
    } catch (adminErr) {
      console.error("Failed to send admin reschedule notification", adminErr);
    }

    // Send admin SMS notification
    try {
      const smsBody = `🔄 Booking Rescheduled\n${booking.customer_name}\n${booking.room_title}\n${oldDate} @ ${oldTime} → ${new_date} @ ${normalizedTime}`;
      await sendTwilioSms(resolveAdminPhones(), smsBody);
    } catch (smsErr) {
      console.error("Failed to send admin reschedule SMS", smsErr);
    }

    // Create in-app notification
    await supabase.from("notifications").insert({
      user_email: booking.customer_email,
      title: "Booking Rescheduled",
      message: `Your ${booking.room_title} session has been rescheduled to ${new_date} at ${normalizedTime}.`,
      type: "reschedule",
      booking_id: booking_id,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
