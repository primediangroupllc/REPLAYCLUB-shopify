import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Map storage paths to bucket names
function bucketFor(kind: "id" | "consent"): string {
  return kind === "id" ? "id-verification" : "consent-signatures";
}

// Strip a leading bucket prefix if it was stored that way
function normalize(path: string, bucket: string): string {
  const prefix = `${bucket}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: rows, error } = await supabase.rpc(
      "cleanup_expired_sensitive_data",
    );
    if (error) throw new Error(error.message);

    let deletedFiles = 0;
    let clearedRecords = 0;
    const errors: string[] = [];

    for (const row of rows ?? []) {
      const idPath: string | null = row.id_photo_path;
      const sigPath: string | null = row.consent_signature_path;
      const source: string = row.source_table;
      const recordId: string = row.record_id;

      if (idPath) {
        const b = bucketFor("id");
        const { error: e } = await supabase.storage
          .from(b)
          .remove([normalize(idPath, b)]);
        if (e) errors.push(`${source}/${recordId} id: ${e.message}`);
        else deletedFiles++;
      }
      if (sigPath) {
        const b = bucketFor("consent");
        const { error: e } = await supabase.storage
          .from(b)
          .remove([normalize(sigPath, b)]);
        if (e) errors.push(`${source}/${recordId} sig: ${e.message}`);
        else deletedFiles++;
      }

      const { error: clearErr } = await supabase.rpc("clear_sensitive_data", {
        p_source: source,
        p_record_id: recordId,
      });
      if (clearErr) errors.push(`${source}/${recordId} clear: ${clearErr.message}`);
      else clearedRecords++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        scanned: rows?.length ?? 0,
        deletedFiles,
        clearedRecords,
        errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("cleanup-sensitive-data error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
