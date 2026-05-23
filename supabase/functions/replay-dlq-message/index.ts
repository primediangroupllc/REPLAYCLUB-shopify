import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const auth = req.headers.get("authorization");
    if (!auth) return j({ error: "Unauthorized" }, 401);
    const { data: { user } } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    if (!user) return j({ error: "Unauthorized" }, 401);
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return j({ error: "Forbidden" }, 403);

    const { dlq_name, message_id, target_queue, payload } = await req.json();
    if (!dlq_name || !target_queue || !payload) return j({ error: "dlq_name, target_queue, payload required" }, 400);

    const { data: newId, error: enqErr } = await supabase.rpc("enqueue_email", { queue_name: target_queue, payload });
    if (enqErr) return j({ error: enqErr.message }, 500);
    if (message_id) {
      await supabase.rpc("delete_email", { queue_name: dlq_name, message_id });
    }
    return j({ success: true, new_msg_id: newId });
  } catch (e) { return j({ error: String(e) }, 500); }
});
function j(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }