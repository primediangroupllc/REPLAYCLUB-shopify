import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.3";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: due } = await supabase
      .from("account_deletion_requests")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString())
      .limit(50);

    let processed = 0;
    for (const req of due ?? []) {
      const placeholderEmail = `deleted+${req.user_id}@replayclub.io`;
      // Anonymize financial records (retain for tax)
      await supabase.from("bookings").update({
        customer_name: "Deleted user", customer_email: placeholderEmail, customer_phone: "REDACTED",
        id_photo_url: null, consent_signature_path: null, consent_signer_name: null,
      }).ilike("customer_email", req.user_email);
      await supabase.from("equipment_rentals").update({
        customer_name: "Deleted user", customer_email: placeholderEmail,
        consent_signature_path: null, consent_signer_name: null,
      }).ilike("customer_email", req.user_email);
      await supabase.from("event_rsvps").update({
        user_name: "Deleted user", user_email: placeholderEmail,
      }).ilike("user_email", req.user_email);
      // Delete personal data
      await supabase.from("mixes").delete().eq("user_id", req.user_id);
      await supabase.from("notifications").delete().ilike("user_email", req.user_email);
      await supabase.from("reminder_preferences").delete().ilike("user_email", req.user_email);
      await supabase.from("profiles").delete().eq("id", req.user_id);
      await supabase.from("admin_2fa").delete().eq("user_id", req.user_id);
      // Delete auth user (admin API)
      await supabase.auth.admin.deleteUser(req.user_id);
      await supabase.from("account_deletion_requests").update({
        status: "processed", processed_at: new Date().toISOString(),
      }).eq("id", req.id);
      processed++;
    }
    return new Response(JSON.stringify({ processed }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});