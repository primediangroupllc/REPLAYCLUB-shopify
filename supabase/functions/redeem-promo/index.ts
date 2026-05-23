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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const anonClient = createClient(supabaseUrl, anonKey);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { token, code } = await req.json();

    if (!token || !code) {
      return new Response(
        JSON.stringify({ error: "token and code are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up promo by URL token
    const { data: promo, error: promoError } = await supabase
      .from("promo_codes")
      .select("*")
      .eq("token", token)
      .single();

    if (promoError || !promo) {
      return new Response(
        JSON.stringify({ error: "Invalid promo link" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (promo.redeemed) {
      return new Response(
        JSON.stringify({ error: "This promo has already been redeemed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the 7-digit code
    if (promo.code !== code) {
      return new Response(
        JSON.stringify({ error: "Invalid code. Please check your email and try again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark as redeemed
    const { error: updateError } = await supabase
      .from("promo_codes")
      .update({
        redeemed: true,
        redeemed_by: user.id,
        redeemed_at: new Date().toISOString(),
      })
      .eq("id", promo.id);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: "Failed to redeem promo" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a free booking
    const { error: bookingError } = await supabase.from("bookings").insert({
      customer_name: user.user_metadata?.display_name || user.email || "Promo User",
      customer_email: user.email!,
      customer_phone: "promo",
      room_title: promo.room_title,
      booking_date: new Date().toISOString().split("T")[0],
      booking_time: "TBD - Free Session",
      amount_cents: 0,
      payment_status: "promo",
      tier: "Free Session (Promo)",
    });

    if (bookingError) {
      return new Response(
        JSON.stringify({ error: "Failed to create booking: " + bookingError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, room_title: promo.room_title }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
