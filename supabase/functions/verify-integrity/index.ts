import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.3";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await supabase.rpc("capture_integrity_snapshot");
    const { data: snaps } = await supabase
      .from("integrity_snapshots")
      .select("*")
      .order("snapshot_date", { ascending: false })
      .limit(2);
    if (!snaps || snaps.length < 2) return j({ ok: true, note: "insufficient history" });
    const [latest, prev] = snaps;
    const cols = ["bookings_count", "paid_bookings_count", "rentals_count", "mixes_count", "users_count", "events_count", "rsvps_count", "gift_cards_count"];
    const drops = cols.filter((c) => {
      const p = (prev as any)[c]; const l = (latest as any)[c];
      return p > 10 && l < p * 0.95;
    });
    if (drops.length > 0) {
      console.error("Integrity drop detected", { drops, latest, prev });
    }
    return j({ ok: drops.length === 0, drops, latest, prev });
  } catch (e) { return j({ error: String(e) }, 500); }
});
function j(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }