import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Daily digest: batches all unsent failure_reports into a single admin email.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: rows, error } = await supabase
    .from("failure_reports")
    .select("*")
    .eq("digest_sent", false)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!rows || rows.length === 0) {
    return new Response(JSON.stringify({ sent: 0, message: "No failures to report" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const lines = rows.map((r: any) => {
    const ts = new Date(r.created_at).toISOString().replace("T", " ").slice(0, 19);
    return `[${ts}] ${r.stage} — ${r.customer_email || "anon"} — ${r.error_message?.slice(0, 200) || ""}`;
  }).join("\n");

  const consoleLog = `${rows.length} failure(s) in the last 24h:\n\n${lines}`;

  await supabase.functions.invoke("send-transactional-email", {
    body: {
      templateName: "booking-failure-admin",
      recipientEmail: "replayclubrecords@gmail.com",
      idempotencyKey: `failure-digest-${new Date().toISOString().slice(0, 10)}`,
      templateData: {
        stage: `daily-digest (${rows.length} failures)`,
        errorMessage: `${rows.length} booking failures in the last 24 hours.`,
        occurredAt: new Date().toISOString(),
        consoleLog,
        networkLog: "",
      },
    },
  });

  // Mark all as sent
  const ids = rows.map((r: any) => r.id);
  await supabase
    .from("failure_reports")
    .update({ digest_sent: true, digest_sent_at: new Date().toISOString() })
    .in("id", ids);

  return new Response(JSON.stringify({ sent: rows.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});