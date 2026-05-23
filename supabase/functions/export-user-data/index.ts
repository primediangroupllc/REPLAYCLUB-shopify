import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.3";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const auth = req.headers.get("authorization");
    if (!auth) return j({ error: "Unauthorized" }, 401);
    const { data: { user } } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    if (!user?.email) return j({ error: "Unauthorized" }, 401);

    const email = user.email;
    const [profile, bookings, rentals, mixes, rsvps, gifts, notifications, refunds, prefs] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("bookings").select("*").ilike("customer_email", email),
      supabase.from("equipment_rentals").select("*").ilike("customer_email", email),
      supabase.from("mixes").select("*").eq("user_id", user.id),
      supabase.from("event_rsvps").select("*").ilike("user_email", email),
      supabase.from("gift_cards").select("*").or(`purchaser_email.ilike.${email},recipient_email.ilike.${email}`),
      supabase.from("notifications").select("*").ilike("user_email", email),
      supabase.from("refund_requests").select("*").ilike("customer_email", email),
      supabase.from("reminder_preferences").select("*").ilike("user_email", email),
    ]);

    const exportPayload = {
      exported_at: new Date().toISOString(),
      user: { id: user.id, email },
      profile: profile.data,
      bookings: bookings.data ?? [],
      equipment_rentals: rentals.data ?? [],
      mixes: mixes.data ?? [],
      event_rsvps: rsvps.data ?? [],
      gift_cards: gifts.data ?? [],
      notifications: notifications.data ?? [],
      refund_requests: refunds.data ?? [],
      reminder_preferences: prefs.data ?? [],
    };

    return new Response(JSON.stringify(exportPayload, null, 2), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="replayclub-data-${user.id}.json"`,
      },
    });
  } catch (e) { return j({ error: String(e) }, 500); }
});
function j(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }