import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.3";

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
    const userEmail = claimsData.claims.email;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const {
      token: promoToken,
      booking_date,
      booking_time,
      layout,
      lighting,
      consent_signature_path,
      consent_signer_name,
    } = await req.json();

    if (!promoToken || !booking_date || !booking_time) {
      return new Response(
        JSON.stringify({ error: "token, booking_date, and booking_time are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify promo was redeemed by this user
    const { data: promo, error: promoError } = await supabase
      .from("promo_codes")
      .select("*")
      .eq("token", promoToken)
      .eq("redeemed", true)
      .eq("redeemed_by", userId)
      .single();

    if (promoError || !promo) {
      return new Response(
        JSON.stringify({ error: "Promo not found or not redeemed by you" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for conflicting bookings on that date/time/room
    const { data: conflicts } = await supabase
      .from("bookings")
      .select("id")
      .eq("booking_date", booking_date)
      .eq("room_title", promo.room_title)
      .like("booking_time", booking_time.split(" (")[0] + "%")
      .in("payment_status", ["paid", "promo"])
      .neq("booking_time", "TBD - Free Session");

    if (conflicts && conflicts.length > 0) {
      return new Response(
        JSON.stringify({ error: "That time slot is already booked. Please choose another." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the existing booking with the chosen date/time
    const { data: updatedBookings, error: updateError } = await supabase
      .from("bookings")
      .update({
        booking_date,
        booking_time,
        ...(layout ? { layout } : {}),
        ...(lighting ? { lighting } : {}),
        ...(consent_signature_path ? { consent_signature_path } : {}),
        ...(consent_signer_name ? { consent_signer_name } : {}),
        ...(consent_signature_path || consent_signer_name
          ? { consent_signed_at: new Date().toISOString() }
          : {}),
      })
      .eq("customer_email", userEmail)
      .eq("payment_status", "promo")
      .eq("room_title", promo.room_title)
      .eq("booking_time", "TBD - Free Session")
      .select("id, customer_name");

    if (updateError) {
      return new Response(
        JSON.stringify({ error: "Failed to schedule session: " + updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const booking = updatedBookings?.[0];

    // Auto-create a session invite so the user can share with up to 2 guests
    let inviteToken: string | null = null;
    if (booking) {
      // Check if invite already exists
      const { data: existingInvite } = await supabase
        .from("session_invites")
        .select("token")
        .eq("booking_id", booking.id)
        .maybeSingle();

      if (existingInvite?.token) {
        inviteToken = existingInvite.token;
      } else {
        const { data: newInvite, error: inviteError } = await supabase
          .from("session_invites")
          .insert({
            booking_id: booking.id,
            room_title: promo.room_title,
            booking_date,
            booking_time,
            created_by_name: booking.customer_name || userEmail,
          })
          .select("token")
          .single();
        if (!inviteError && newInvite) inviteToken = newInvite.token;
      }
    }

    // Send notification email to admin
    try {
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "promo-session-booked",
          recipientEmail: "replayclubrecords@gmail.com",
          idempotencyKey: `promo-booked-${promo.id}-${booking_date}-${booking_time}`,
          templateData: {
            customerName: userEmail,
            customerEmail: userEmail,
            roomTitle: promo.room_title,
            bookingDate: booking_date,
            bookingTime: booking_time,
            layout: layout || "",
            lighting: lighting || "",
          },
        },
      });
    } catch (emailErr) {
      console.error("Failed to send admin notification email", emailErr);
    }

    // Send confirmation email to customer
    try {
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "promo-booking-confirmation",
          recipientEmail: userEmail,
          idempotencyKey: `promo-confirm-${promo.id}-${booking_date}-${booking_time}`,
          templateData: {
            customerName: userEmail,
            roomTitle: promo.room_title,
            bookingDate: booking_date,
            bookingTime: booking_time,
            layout: layout || "",
            lighting: lighting || "",
          },
        },
      });
    } catch (emailErr) {
      console.error("Failed to send customer confirmation email", emailErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        room_title: promo.room_title,
        invite_token: inviteToken,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
