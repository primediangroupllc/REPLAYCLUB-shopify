import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.3";
import { resolveSmsFrom } from "../_shared/site-settings.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { booking_id } = await req.json();
    if (!booking_id) return j({ error: "booking_id required" }, 400);

    const { data: booking } = await supabase.from("bookings").select("*").eq("id", booking_id).maybeSingle();
    if (!booking?.customer_phone) return j({ skipped: true });

    const { data: prefs } = await supabase.from("reminder_preferences").select("sms_enabled")
      .ilike("user_email", booking.customer_email).maybeSingle();
    if (prefs && prefs.sms_enabled === false) return j({ skipped: true });

    const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const tok = Deno.env.get("TWILIO_AUTH_TOKEN");
    const from = await resolveSmsFrom();
    if (!sid || !tok || !from) return j({ skipped: true, reason: "twilio not configured" });

    const body = `Replay Club: Confirmed ${booking.room_title} on ${booking.booking_date} @ ${booking.booking_time}. Show your QR at the door. Reply STOP to opt out.`;
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: "Basic " + btoa(`${sid}:${tok}`), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: booking.customer_phone, From: from, Body: body }),
    });
    if (!r.ok) return j({ error: await r.text() }, 502);
    return j({ success: true });
  } catch (e) { return j({ error: String(e) }, 500); }
});
function j(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }