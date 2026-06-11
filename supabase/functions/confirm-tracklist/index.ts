// confirm-tracklist — reviewer-agnostic confirm for a mix's recognition job.
// V1: admin only (the reviewer abstraction lets an AI service call the same path
// with review_source='ai' in V2 — no schema change). Validates the mix's
// confirmed_tracklist, marks the active job confirmed, and mirrors the simple
// {title,artist}[] into mixes.tracklist for display. NO ACRCloud, NO secrets —
// works on its own. (verify_jwt defaults to true; the admin sends a user JWT.)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import {
  buildJobConfirmFields,
  renumberPositions,
  toDisplayTracklist,
  validateTracklistForConfirm,
} from "../_shared/recognition/tracklistConfirm.ts";
import type { ConfirmedTrackRow } from "../_shared/recognition/trackSegmentMerge.ts";

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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: { user } } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    if (!user?.email) return j({ error: "Unauthorized" }, 401);
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) return j({ error: "Forbidden" }, 403);

    const { mix_id } = await req.json().catch(() => ({}));
    if (!mix_id) return j({ error: "mix_id required" }, 400);

    // Newest (active) recognition job for the mix.
    const { data: job } = await supabase
      .from("mix_recognition_jobs")
      .select("id, status")
      .eq("mix_id", mix_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!job) return j({ error: "no recognition job for this mix" }, 404);

    // The reviewed tracklist (admin will have edited/cleaned it pre-confirm).
    const { data: rows } = await supabase
      .from("confirmed_tracklist")
      .select("*")
      .eq("mix_id", mix_id)
      .order("position", { ascending: true });
    const original = (rows ?? []) as unknown as Array<
      ConfirmedTrackRow & { id: string }
    >;
    // Decision A: renumber 1..n before validating (review deletes/adds can leave
    // position gaps), and persist any row whose position changed.
    const tracklist = renumberPositions(original);
    for (const r of tracklist) {
      const orig = original.find((o) => o.id === r.id);
      if (orig && orig.position !== r.position) {
        await supabase
          .from("confirmed_tracklist")
          .update({ position: r.position })
          .eq("id", r.id);
      }
    }

    const errors = validateTracklistForConfirm(tracklist);
    if (errors.length) {
      return j({ error: "tracklist not ready to confirm", details: errors }, 400);
    }

    const confirmFields = buildJobConfirmFields(
      { source: "admin", reviewedBy: user.id },
      new Date().toISOString(),
    );
    const { error: jobErr } = await supabase
      .from("mix_recognition_jobs")
      .update(confirmFields)
      .eq("id", job.id);
    if (jobErr) return j({ error: jobErr.message }, 500);

    // Mirror display tracklist into mixes.tracklist (service_role bypasses the
    // enforce_mix_write_rules lock).
    await supabase
      .from("mixes")
      .update({ tracklist: toDisplayTracklist(tracklist) })
      .eq("id", mix_id);

    return j({ ok: true, job_id: job.id, confirmed_tracks: tracklist.length });
  } catch (e) {
    return j({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
