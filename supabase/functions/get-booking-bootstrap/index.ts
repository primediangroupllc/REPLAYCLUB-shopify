import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Single round-trip bootstrap for the booking modal.
 * Returns auth/profile/loyalty/admin/equipment-status in one call instead of
 * 4 sequential client-side requests. Anonymous callers get a partial payload
 * (no profile / loyalty / admin) — safe to call without a JWT.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Identify caller from JWT (optional)
    let userId: string | null = null;
    let userEmail: string | null = null;
    let userPhone: string | null = null;
    let userFullName: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice("Bearer ".length);
      const { data: userData } = await admin.auth.getUser(token);
      if (userData?.user) {
        userId = userData.user.id;
        userEmail = userData.user.email ?? null;
        // Optional day-of contact prefill for the booking modal. This is not a
        // security factor; Stripe Identity handles ID verification in PR 4a.
        // Returning it here lets the client avoid asking again when available.
        userPhone = userData.user.phone ?? null;
        // PR 4c — pull full name from auth metadata so the new flow (which
        // dropped the Email-Verify step) can auto-populate the customer name
        // without showing a name input on the Tier step.
        const meta = userData.user.user_metadata ?? {};
        userFullName =
          (typeof meta.full_name === "string" && meta.full_name.trim()) ||
          (typeof meta.name === "string" && meta.name.trim()) ||
          null;
      }
    }

    // Allow client to override the loyalty lookup email (guest bookings)
    let bodyEmail: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (typeof body?.email === "string") bodyEmail = body.email;
      } catch { /* no body, ignore */ }
    }
    const loyaltyEmail = bodyEmail || userEmail;

    // Run everything in parallel
    const [profileRes, loyaltyRes, roleRes, equipRes] = await Promise.all([
      userId
        ? admin.from("profiles").select("display_name").eq("id", userId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      loyaltyEmail
        ? admin.rpc("get_loyalty_info", { user_email: loyaltyEmail })
        : Promise.resolve({ data: null, error: null }),
      userId
        ? admin.rpc("has_role", { _user_id: userId, _role: "admin" })
        : Promise.resolve({ data: false, error: null }),
      admin
        .from("equipment_status")
        .select("equipment_name, is_available, expected_available_at, maintenance_note")
        .eq("is_available", false),
    ]);

    // Compute loyalty tier with recurring percent discount
    const bookingCount =
      (loyaltyRes?.data as { booking_count?: number } | null)?.booking_count ?? 0;
    const TIER_LADDER: Array<{ min: number; name: string; percent: number }> = [
      { min: 100, name: "Obsidian", percent: 30 },
      { min: 50, name: "Diamond", percent: 25 },
      { min: 20, name: "Platinum", percent: 20 },
      { min: 10, name: "Gold", percent: 15 },
      { min: 5, name: "Silver", percent: 10 },
      { min: 3, name: "Bronze", percent: 5 },
    ];
    const matched = TIER_LADDER.find((t) => bookingCount >= t.min);
    const loyaltyTier = matched
      ? { tier: matched.name, percent: matched.percent }
      : null;

    const payload = {
      user: userId
        ? {
            id: userId,
            email: userEmail,
            phone: userPhone ?? null,
            full_name: userFullName,
          }
        : null,
      profile: profileRes?.data ?? null,
      isAdmin: !!roleRes?.data,
      bookingCount,
      loyaltyTier,
      unavailableEquipment: equipRes?.data ?? [],
    };

    return new Response(JSON.stringify(payload), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        // Caller-side cache: 30s — matches the BookingModal staleTime
        "Cache-Control": "private, max-age=30",
      },
      status: 200,
    });
  } catch (err) {
    console.error("get-booking-bootstrap error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "unknown" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});