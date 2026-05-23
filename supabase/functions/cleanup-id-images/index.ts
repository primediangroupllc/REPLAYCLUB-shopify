// Cleanup expired ID images from the id-verifications storage bucket.
// Runs nightly via pg_cron. Anchored on bookings.booking_date (Option A).
// TODO(retention): swap to bookings.session_end_time once that column exists
// — the date anchor lives in the SQL helper public.list_expired_id_verifications.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "id-verifications";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startedAt = new Date().toISOString();
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1) Read retention config from site_settings.
  const { data: settings, error: settingsErr } = await admin
    .from("site_settings")
    .select("id_retention_days, id_retention_enabled")
    .order("id")
    .limit(1)
    .maybeSingle();

  if (settingsErr) {
    console.error("[cleanup-id] settings_read_error", settingsErr.message);
    return json({ error: "settings_read_failed" }, 500);
  }

  const enabled = settings?.id_retention_enabled !== false;
  const retentionDays = Number(settings?.id_retention_days ?? 30);

  if (!enabled) {
    console.log("[cleanup-id] disabled via site_settings.id_retention_enabled");
    await writeAudit(admin, { skipped: "disabled", retentionDays });
    return json({ ok: true, skipped: "disabled", deleted: 0, failed: 0 });
  }

  // 2) List eligible verifications.
  const { data: rows, error: listErr } = await admin.rpc(
    "list_expired_id_verifications",
    { p_retention_days: retentionDays },
  );

  if (listErr) {
    console.error("[cleanup-id] list_error", listErr.message);
    return json({ error: "list_failed" }, 500);
  }

  const targets = (rows ?? []) as Array<{
    verification_id: string;
    booking_id: string;
    storage_path: string;
    booking_date: string;
  }>;

  // Zero-record runs are normal — log cleanly, no warnings.
  console.log(`[cleanup-id] ${targets.length} candidate(s) found (retention=${retentionDays}d)`);

  let deleted = 0;
  let failed = 0;
  const failures: Array<{ id: string; reason: string }> = [];

  // 3) Delete storage object then mark row, one at a time so a single failure
  //    doesn't block the rest of the batch.
  for (const row of targets) {
    try {
      const { error: storageErr } = await admin.storage
        .from(BUCKET)
        .remove([row.storage_path]);

      // Storage "not found" is acceptable — file may have been removed manually
      // or never persisted. Still mark the row deleted to keep state consistent.
      if (storageErr && !/not.?found|does not exist/i.test(storageErr.message)) {
        failed++;
        failures.push({ id: row.verification_id, reason: storageErr.message });
        console.error("[cleanup-id] storage_remove_failed", row.verification_id, storageErr.message);
        continue;
      }

      const { error: markErr } = await admin.rpc("mark_id_verification_deleted", {
        p_verification_id: row.verification_id,
        p_reason: "retention_expired",
      });

      if (markErr) {
        failed++;
        failures.push({ id: row.verification_id, reason: markErr.message });
        console.error("[cleanup-id] mark_failed", row.verification_id, markErr.message);
        continue;
      }

      deleted++;
    } catch (e) {
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      failures.push({ id: row.verification_id, reason: msg });
      console.error("[cleanup-id] unexpected_error", row.verification_id, msg);
    }
  }

  console.log(`[cleanup-id] ${deleted} deleted, ${failed} failed`);

  await writeAudit(admin, {
    retentionDays,
    candidates: targets.length,
    deleted,
    failed,
    startedAt,
    finishedAt: new Date().toISOString(),
    failures: failures.slice(0, 25), // cap to keep payload bounded
  });

  return json({ ok: true, deleted, failed, candidates: targets.length });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Service-role insert into audit_log with NULL admin_user_id (system actor).
async function writeAudit(
  admin: ReturnType<typeof createClient>,
  details: Record<string, unknown>,
) {
  const { error } = await admin.from("audit_log").insert({
    admin_user_id: null,
    action: "delete",
    entity_type: "id_verification_cleanup",
    entity_id: null,
    details,
  });
  if (error) {
    console.error("[cleanup-id] audit_write_failed", error.message);
  }
}