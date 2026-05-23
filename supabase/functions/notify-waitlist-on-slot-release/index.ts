import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Triggered (via pg_net from a DB trigger) when a slot_lock is deleted.
 * Notifies any waitlisted users for that slot via the waitlist-spot-open
 * email template and marks them as notified.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { roomTitle, bookingDate, bookingTime } = await req.json();
    if (!roomTitle || !bookingDate || !bookingTime) {
      return new Response(JSON.stringify({ error: "Missing roomTitle/bookingDate/bookingTime" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Skip entirely if a paid booking now occupies the slot (race protection)
    const { data: paidBookings } = await supabase
      .from("bookings")
      .select("id")
      .eq("room_title", roomTitle)
      .eq("booking_date", bookingDate)
      .eq("booking_time", bookingTime)
      .in("payment_status", ["paid", "promo"])
      .limit(1);

    if (paidBookings && paidBookings.length > 0) {
      return new Response(JSON.stringify({ skipped: "slot_now_paid" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: waiters } = await supabase
      .from("waitlist")
      .select("id, user_email")
      .eq("room_title", roomTitle)
      .eq("booking_date", bookingDate)
      .eq("booking_time", bookingTime)
      .eq("notified", false);

    if (!waiters || waiters.length === 0) {
      return new Response(JSON.stringify({ notified: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let notified = 0;
    for (const w of waiters) {
      try {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "waitlist-spot-open",
            recipientEmail: w.user_email,
            idempotencyKey: `waitlist-notify-${w.id}`,
            templateData: {
              roomTitle,
              bookingDate,
              bookingTime,
            },
          },
        });

        await supabase.from("notifications").insert({
          user_email: w.user_email,
          title: "Spot Available!",
          message: `A spot opened up for ${roomTitle} on ${bookingDate} at ${bookingTime}. Book now!`,
          type: "waitlist",
        });

        await supabase
          .from("waitlist")
          .update({ notified: true, notified_at: new Date().toISOString() })
          .eq("id", w.id);

        notified++;
      } catch (err) {
        console.error(`Failed to notify waitlist entry ${w.id}:`, err);
      }
    }

    return new Response(JSON.stringify({ notified }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("notify-waitlist-on-slot-release error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});