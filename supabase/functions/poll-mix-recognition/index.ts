// poll-mix-recognition — Stage B pt2 poller. SERVICE-ONLY: the bearer must equal
// the service-role key (verify_jwt stays true so the gateway also requires a JWT;
// this extra check blocks any logged-in *user* JWT from driving polls). Intended
// to be invoked by cron — cron registration is a separate, later migration.
//
// Finds 'processing' jobs, asks ACRCloud for results, and on ready writes
// recognized_track_segments + confirmed_tracklist(source='auto') and moves the
// job to 'recognition_complete'. It deliberately does NOT mirror into
// mixes.tracklist and never sets 'confirmed' — publishing auto-detected tracks to
// the display stays gated behind confirm-tracklist (human/AI review), per
// TRUTH-SPEC. GATED on acrCloudConfigured().
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  acrCloudConfigured,
  getAcrCloudConfig,
} from "../_shared/recognition/acrCloudConfig.ts";
import { getFileScanResult } from "../_shared/recognition/acrCloudClient.ts";
import {
  buildPersistFromResult,
  failAfterTransientError,
  outcomeForState,
} from "../_shared/recognition/scanOrchestration.ts";

const BATCH = 25;

// Decode JWT claims WITHOUT verifying the signature — the platform gateway
// (verify_jwt=true) has already validated the signature before this code runs;
// we only need the role claim. Mirrors process-email-queue's guard.
function parseJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = parts[1]
      .replaceAll("-", "+")
      .replaceAll("_", "/")
      .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
    return JSON.parse(atob(payload)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const j = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });

  // SERVICE-ONLY guard. SUPABASE_SERVICE_ROLE_KEY is kept ONLY as the DB client
  // credential (createClient below) — NOT for auth: under the new API-key model
  // the runtime injects an sb_secret_* value here, which is NOT the legacy
  // service-role JWT the cron sends, so the old raw-string equality rejected every
  // cron call (403). verify_jwt=true means the gateway already verified the
  // bearer's signature; we just require the service-role claim so only the cron
  // (service role) — not a logged-in user JWT — can drive polls.
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return j({ error: "Unauthorized" }, 401);
  const claims = parseJwtClaims(authHeader.slice("Bearer ".length).trim());
  if (claims?.role !== "service_role") return j({ error: "Forbidden" }, 403);

  if (!acrCloudConfigured()) return j({ configured: false, processed: 0 }, 200);
  const cfg = getAcrCloudConfig()!;

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
  const nowIso = () => new Date().toISOString();

  const { data: jobs, error } = await supabase
    .from("mix_recognition_jobs")
    .select("id, mix_id, provider_file_id, retry_count")
    .eq("status", "processing")
    .not("provider_file_id", "is", null)
    .order("last_polled_at", { ascending: true, nullsFirst: true })
    .limit(BATCH);
  if (error) return j({ error: error.message }, 500);

  const results: { job_id: string; status: string }[] = [];

  for (const job of jobs ?? []) {
    try {
      const { state, raw } = await getFileScanResult(
        cfg,
        job.provider_file_id as string,
      );
      const outcome = outcomeForState(state);

      if (!outcome.terminal) {
        await supabase
          .from("mix_recognition_jobs")
          .update({ last_polled_at: nowIso() })
          .eq("id", job.id);
        results.push({ job_id: job.id, status: "processing" });
        continue;
      }

      if (outcome.parseResult) {
        const { segments, tracklist } = buildPersistFromResult(raw, {
          jobId: job.id,
          mixId: job.mix_id,
        });
        if (segments.length) {
          await supabase.from("recognized_track_segments").insert(segments);
        }
        if (tracklist.length) {
          await supabase.from("confirmed_tracklist").insert(tracklist);
        }
      }

      await supabase
        .from("mix_recognition_jobs")
        .update({
          status: outcome.status,
          error_message: outcome.errorMessage,
          provider_summary: { state, polled_at: nowIso() },
          last_polled_at: nowIso(),
        })
        .eq("id", job.id);
      results.push({ job_id: job.id, status: outcome.status });
    } catch (e) {
      // Transient fetch error — keep the job processing, bump retry_count, and
      // only give up after MAX_POLL_RETRIES.
      const giveUp = failAfterTransientError(job.retry_count ?? 0);
      await supabase
        .from("mix_recognition_jobs")
        .update({
          retry_count: (job.retry_count ?? 0) + 1,
          last_polled_at: nowIso(),
          ...(giveUp
            ? { status: "failed", error_message: String((e as Error)?.message ?? e) }
            : {}),
        })
        .eq("id", job.id);
      results.push({ job_id: job.id, status: giveUp ? "failed" : "processing" });
    }
  }

  return j({ configured: true, processed: results.length, results });
});
