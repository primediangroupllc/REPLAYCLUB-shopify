import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.3";
import { resolveAdminEmails, sendTwilioSms, resolveAdminPhones } from "../_shared/site-settings.ts";
import { parseBookingDateTime } from "../_shared/bookingTime.ts";

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

    // Update booking
    const { error: updateError } = await supabase
      .from("bookings")
      .update({ booking_date: new_date, booking_time: new_time })
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
        idempotencyKey: `reschedule-${booking_id}-${new_date}-${new_time}`,
        templateData: {
          customerName: booking.customer_name,
          roomTitle: booking.room_title,
          oldDate,
          oldTime,
          newDate: new_date,
          newTime: new_time,
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
            idempotencyKey: `reschedule-admin-${booking_id}-${new_date}-${new_time}-${adminEmail}`,
            templateData: {
              customerName: booking.customer_name,
              customerEmail: booking.customer_email,
              roomTitle: booking.room_title,
              oldDate,
              oldTime,
              newDate: new_date,
              newTime: new_time,
            },
          },
        })
      ));
    } catch (adminErr) {
      console.error("Failed to send admin reschedule notification", adminErr);
    }

    // Send admin SMS notification
    try {
      const smsBody = `🔄 Booking Rescheduled\n${booking.customer_name}\n${booking.room_title}\n${oldDate} @ ${oldTime} → ${new_date} @ ${new_time}`;
      await sendTwilioSms(resolveAdminPhones(), smsBody);
    } catch (smsErr) {
      console.error("Failed to send admin reschedule SMS", smsErr);
    }

    // Create in-app notification
    await supabase.from("notifications").insert({
      user_email: booking.customer_email,
      title: "Booking Rescheduled",
      message: `Your ${booking.room_title} session has been rescheduled to ${new_date} at ${new_time}.`,
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
