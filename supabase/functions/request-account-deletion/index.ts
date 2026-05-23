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

    const { reason, action } = await req.json().catch(() => ({}));

    if (action === "cancel") {
      const { error } = await supabase.from("account_deletion_requests")
        .update({ status: "cancelled" })
        .eq("user_id", user.id)
        .eq("status", "pending");
      if (error) return j({ error: error.message }, 500);
      return j({ success: true, status: "cancelled" });
    }

    const { data: existing } = await supabase
      .from("account_deletion_requests")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .maybeSingle();
    if (existing) return j({ error: "Deletion already pending" }, 400);

    const { data, error } = await supabase.from("account_deletion_requests").insert({
      user_id: user.id, user_email: user.email, reason: reason ?? null,
    }).select().single();
    if (error) return j({ error: error.message }, 500);

    await supabase.from("notifications").insert({
      user_email: user.email,
      title: "Account Deletion Scheduled",
      message: `Your account will be deleted on ${new Date(data.scheduled_for).toLocaleDateString()}. Sign in before then to cancel.`,
      type: "account",
    });

    return j({ success: true, scheduled_for: data.scheduled_for });
  } catch (e) { return j({ error: String(e) }, 500); }
});
function j(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }