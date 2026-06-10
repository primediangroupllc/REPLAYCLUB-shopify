// start-mix-recognition — Stage B pt2 trigger. An owner (first job) or admin
// (re-scan) submits a mix's audio to ACRCloud File Scanning.
//
// GATED: when the ACRCloud secrets are absent this returns a clean not_configured
// no-op and creates NO job — so a user's one-job-per-mix allowance is never burned
// while we can't actually scan. Privileged DB work runs via service_role
// (BYPASSRLS); the cost guardrail (migration 20260606170000, "Owners start first
// recognition job") is therefore enforced in code here. verify_jwt defaults to
// true; the caller sends a user JWT.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import {
  acrCloudConfigured,
  getAcrCloudConfig,
} from "../_shared/recognition/acrCloudConfig.ts";
import { submitFileScan } from "../_shared/recognition/acrCloudClient.ts";

// Original upload URL → storage path (mirrors get-mix-signed-url's toStoragePath).
function toStoragePath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("http")) return raw;
  try {
    const u = new URL(raw);
    const m = u.pathname.match(
      /\/storage\/v1\/object\/(?:public|sign)\/mixes\/(.+)/,
    );
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  const j = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return j({ error: "Unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = createClient(
      url,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!);

    const { data: { user } } = await anon.auth.getUser(
      auth.replace("Bearer ", ""),
    );
    if (!user) return j({ error: "Unauthorized" }, 401);

    const { mix_id } = await req.json().catch(() => ({}));
    if (!mix_id) return j({ error: "mix_id required" }, 400);

    const { data: mix } = await service
      .from("mixes")
      .select("id, user_id, file_url, streaming_url")
      .eq("id", mix_id)
      .maybeSingle();
    if (!mix) return j({ error: "Mix not found" }, 404);

    const isOwner = mix.user_id === user.id;
    const { data: isAdmin } = await service.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isOwner && !isAdmin) return j({ error: "Access denied" }, 403);

    // GATE: no secrets → no-op, no job created (don't burn the one-job allowance).
    if (!acrCloudConfigured()) {
      return j({ configured: false, status: "not_configured" }, 200);
    }
    const cfg = getAcrCloudConfig()!;

    // Cost guardrail (service_role bypasses the RLS INSERT policy, so enforce
    // here): a user gets exactly ONE job per mix; a re-scan must be admin.
    const { data: existing } = await service
      .from("mix_recognition_jobs")
      .select("id")
      .eq("mix_id", mix_id);
    const priorCount = existing?.length ?? 0;
    if (priorCount > 0 && !isAdmin) {
      return j({ error: "recognition already requested for this mix" }, 409);
    }

    // Sign the original audio so ACRCloud can pull it (2h TTL, matches
    // get-mix-signed-url). Prefer the full-quality upload over the stream.
    const path = toStoragePath(mix.file_url ?? mix.streaming_url);
    if (!path) return j({ error: "Mix has no audio file" }, 400);
    const { data: signed, error: signErr } = await service.storage
      .from("mixes")
      .createSignedUrl(path, 7200);
    if (signErr || !signed) return j({ error: "Failed to sign mix audio" }, 500);

    const requested_by_role = isOwner && !isAdmin ? "user" : "admin";
    const { data: job, error: jobErr } = await service
      .from("mix_recognition_jobs")
      .insert({
        mix_id,
        requested_by: user.id,
        requested_by_role,
        retry_count: priorCount, // re-scans increment the attempt count
        status: "queued",
      })
      .select("id")
      .single();
    if (jobErr || !job) {
      return j({ error: jobErr?.message ?? "Failed to create job" }, 500);
    }

    try {
      const { fileId } = await submitFileScan(cfg, {
        url: signed.signedUrl,
        name: `mix-${mix_id}`,
      });
      await service
        .from("mix_recognition_jobs")
        .update({
          status: "processing",
          provider_file_id: fileId,
          last_polled_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      return j({ ok: true, job_id: job.id, status: "processing" }, 202);
    } catch (e) {
      await service
        .from("mix_recognition_jobs")
        .update({
          status: "failed",
          error_message: String((e as Error)?.message ?? e),
        })
        .eq("id", job.id);
      return j({ error: "ACRCloud submit failed", job_id: job.id }, 502);
    }
  } catch (e) {
    return j({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
