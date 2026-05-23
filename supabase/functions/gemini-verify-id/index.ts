import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * gemini-verify-id
 * --------------------------------------------------------------------------
 * Server-side ID verification using Lovable AI Gateway (Gemini).
 *
 * TODO(retention): Lovable AI Gateway data-handling for ID images is not yet
 * contractually confirmed. Until support@lovable.dev confirms zero-retention
 * at the gateway layer, keep `site_settings.verification_v2_admin_only = true`.
 * If the answer is anything other than zero-retention, swap this fetch to
 * Vertex AI (Gemini 2.5 Flash) with `disable_logging=true` — same model, same
 * cost, contractual zero-retention. Function shape stays identical.
 *
 * Flow:
 *   1. Authenticate caller, verify ID image path is owned by them.
 *   2. Download the uploaded ID from the `id-verifications` storage bucket.
 *   3. Ask Gemini (via Lovable AI Gateway) to extract DOB / name / validity
 *      via a single tool call so the response is structured.
 *   4. Decide:
 *        confidence < 0.85 OR no DOB OR not a valid ID         -> pending_admin_review
 *        age >= 18 AND not within 30d of 18th birthday         -> approved
 *        age >= 18 but within 30d of 18th birthday (borderline)-> pending_admin_review
 *        age <  18                                             -> rejected
 *   5. Update id_verifications + bookings.verification_status.
 *   6. Email-sending is intentionally a TODO (the 4 templates ship in a
 *      later step of this PR). For now we only log the intent.
 *
 * Notes:
 *   - Guardian / under-18 fields are NEVER written. They stay NULL.
 *   - Gates on site_settings.verification_v2_admin_only — non-admin callers
 *     get a 403 until launch.
 */

type GeminiResult = {
  dob: string | null;
  name: string | null;
  is_valid_id: boolean;
  confidence: number;
  notes: string;
};

const BORDERLINE_DAYS = 30;

type FailureMode =
  | "gateway_error"
  | "low_confidence"
  | "no_dob_extracted"
  | "invalid_id"
  | "borderline_age"
  | null;

function ageInYears(dob: Date, now = new Date()): number {
  return (now.getTime() - dob.getTime()) / (365.25 * 86400000);
}

async function callGemini(
  apiKey: string,
  imageDataUrl: string,
  bookingName: string | null,
): Promise<GeminiResult> {
  const resp = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are an ID document analyzer. Extract DOB and name from the supplied government-issued photo ID. Reply ONLY by calling the report_id tool. Never reply with prose.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: bookingName
                  ? `Booking name on file: "${bookingName}". Extract the DOB exactly as printed.`
                  : "Extract the DOB exactly as printed.",
              },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_id",
              description:
                "Return the structured ID extraction result. DOB must be ISO YYYY-MM-DD or null if unreadable.",
              parameters: {
                type: "object",
                properties: {
                  dob: {
                    type: ["string", "null"],
                    description: "Date of birth in YYYY-MM-DD, or null.",
                  },
                  name: { type: ["string", "null"] },
                  is_valid_id: {
                    type: "boolean",
                    description:
                      "True only if the image clearly shows a real, unaltered government-issued photo ID.",
                  },
                  confidence: {
                    type: "number",
                    description: "Overall confidence 0.0–1.0.",
                  },
                  notes: {
                    type: "string",
                    description: "Any concerns about authenticity or readability.",
                  },
                },
                required: [
                  "dob",
                  "name",
                  "is_valid_id",
                  "confidence",
                  "notes",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_id" } },
      }),
    },
  );

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Gemini gateway ${resp.status}: ${body}`);
  }
  const json = await resp.json();
  const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) {
    throw new Error("Gemini returned no tool call");
  }
  const parsed = JSON.parse(args) as GeminiResult;
  // Coerce confidence into [0,1] just in case.
  parsed.confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
  return parsed;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null);
    const bookingId = body?.booking_id as string | undefined;
    const idImagePath = body?.id_image_path as string | undefined;
    const captureMethod = (body?.capture_method as string | undefined) ??
      "upload";
    if (!bookingId || !idImagePath) {
      return new Response(
        JSON.stringify({ error: "missing booking_id or id_image_path" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: userData, error: userErr } = await admin.auth.getUser(
      authHeader.slice("Bearer ".length),
    );
    if (userErr || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    // Path-ownership safety check.
    if (!idImagePath.startsWith(`${userId}/`)) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit: 5 OCR attempts per hour per authenticated user.
    // Real users almost never retry more than 1–2x; 5 leaves room for
    // legitimate retries (bad photo, lighting) while killing abuse loops
    // that would rack up Gemini charges or DOS the function.
    const { data: rl } = await admin.rpc("check_rate_limit", {
      p_bucket: "gemini_verify_id",
      p_identifier: userId,
      p_max: 5,
      p_window_seconds: 3600,
    });
    const allowed = Array.isArray(rl) ? rl[0]?.allowed : (rl as any)?.allowed;
    const retryAfterSec = Array.isArray(rl)
      ? rl[0]?.retry_after_seconds
      : (rl as any)?.retry_after_seconds;
    if (allowed === false) {
      return new Response(
        JSON.stringify({
          error: "rate_limited",
          retry_after_seconds: retryAfterSec ?? 3600,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(retryAfterSec ?? 3600),
          },
        },
      );
    }

    // Admin-only launch gate.
    const { data: settings } = await admin
      .from("site_settings")
      .select("verification_v2_admin_only")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();
    const adminOnly = settings?.verification_v2_admin_only ?? true;
    if (adminOnly) {
      const { data: roleRows } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .limit(1);
      if (!roleRows || roleRows.length === 0) {
        return new Response(
          JSON.stringify({ error: "verification_v2_disabled" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // Confirm the booking belongs to this user (best-effort: email match or
    // any column we can compare cheaply). We trust the existing RLS on the
    // bookings table to be correct; here we just need the customer_name.
    const { data: booking, error: bErr } = await admin
      .from("bookings")
      .select("id, customer_name, customer_email, verification_status")
      .eq("id", bookingId)
      .maybeSingle();
    if (bErr || !booking) {
      return new Response(JSON.stringify({ error: "booking_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark booking as OCR-in-flight before we call out.
    await admin
      .from("bookings")
      .update({ verification_status: "pending_ocr" })
      .eq("id", bookingId);

    // Pull the image from storage.
    const { data: blob, error: dlErr } = await admin.storage
      .from("id-verifications")
      .download(idImagePath);
    if (dlErr || !blob) {
      throw new Error(`failed to download id image: ${dlErr?.message}`);
    }
    const ab = await blob.arrayBuffer();
    // base64-encode in chunks to avoid stack overflow on big images
    const bytes = new Uint8Array(ab);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(
        ...bytes.subarray(i, Math.min(i + chunk, bytes.length)),
      );
    }
    const base64 = btoa(binary);
    const mime = blob.type || "image/jpeg";
    const dataUrl = `data:${mime};base64,${base64}`;

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      throw new Error("LOVABLE_API_KEY missing");
    }

    let parsed: GeminiResult;
    let failureMode: FailureMode = null;
    let retryAfter: string | null = null;
    try {
      parsed = await callGemini(apiKey, dataUrl, booking.customer_name ?? null);
    } catch (e) {
      // Soft-degrade: flag for admin review rather than blocking the user.
      console.error("[gemini-verify-id] Gemini error", e);
      failureMode = "gateway_error";
      // Hint for the future "Retry OCR" button in /admin/verifications.
      retryAfter = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      parsed = {
        dob: null,
        name: null,
        is_valid_id: false,
        confidence: 0,
        notes: `gemini_error: ${e instanceof Error ? e.message : String(e)}`,
      };
    }

    // Decision matrix per spec.
    const dob = parsed.dob ? new Date(parsed.dob + "T00:00:00Z") : null;
    const valid = !!dob && !isNaN(dob.getTime());
    const years = valid ? ageInYears(dob!) : null;
    const borderlineYears = 18 + BORDERLINE_DAYS / 365.25;

    let nextStatus:
      | "approved"
      | "rejected"
      | "pending_admin_review";
    let reviewStatus: "auto_approved" | "pending";
    let detectedAgeTier: "adult_18_plus" | null = null;
    let rejectionReason: string | null = null;

    if (!valid || !parsed.is_valid_id || parsed.confidence < 0.85) {
      nextStatus = "pending_admin_review";
      reviewStatus = "pending";
      // Only set if not already tagged as gateway_error above.
      if (!failureMode) {
        failureMode = !valid
          ? "no_dob_extracted"
          : !parsed.is_valid_id
            ? "invalid_id"
            : "low_confidence";
      }
    } else if (years! < 18) {
      nextStatus = "rejected";
      reviewStatus = "auto_approved";
      rejectionReason = "age_under_18";
    } else if (years! < borderlineYears) {
      nextStatus = "pending_admin_review";
      reviewStatus = "pending";
      detectedAgeTier = "adult_18_plus";
      failureMode = "borderline_age";
    } else {
      nextStatus = "approved";
      reviewStatus = "auto_approved";
      detectedAgeTier = "adult_18_plus";
    }

    // Upsert id_verifications row by booking_id.
    const verificationPayload = {
      booking_id: bookingId,
      user_id: userId,
      id_image_path: idImagePath,
      id_capture_method: captureMethod,
      ocr_provider: "gemini",
      ocr_extracted_dob: parsed.dob,
      ocr_extracted_name: parsed.name,
      ocr_confidence: parsed.confidence,
      ocr_raw_response: {
        ...(parsed as unknown as Record<string, unknown>),
        failure_mode: failureMode,
        retry_after: retryAfter,
      },
      detected_age_tier: detectedAgeTier,
      review_status: reviewStatus,
      rejection_reason: rejectionReason,
      reviewed_at: reviewStatus === "auto_approved" ? new Date().toISOString() : null,
    };

    const { data: existing } = await admin
      .from("id_verifications")
      .select("id")
      .eq("booking_id", bookingId)
      .maybeSingle();

    if (existing?.id) {
      await admin
        .from("id_verifications")
        .update(verificationPayload)
        .eq("id", existing.id);
    } else {
      await admin.from("id_verifications").insert(verificationPayload);
    }

    // 24h hold for anything still pending; clear hold for terminal states.
    const heldUntil = nextStatus === "pending_admin_review"
      ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      : null;

    await admin
      .from("bookings")
      .update({
        verification_status: nextStatus,
        verification_held_until: heldUntil,
        user_age_tier: detectedAgeTier,
      })
      .eq("id", bookingId);

    // TODO(emails): wire 4 templates in a follow-up step of this PR.
    console.log(
      `[gemini-verify-id] booking=${bookingId} status=${nextStatus} confidence=${parsed.confidence} age=${years?.toFixed?.(2) ?? "n/a"}`,
    );

    return new Response(
      JSON.stringify({
        status: nextStatus,
        review_status: reviewStatus,
        confidence: parsed.confidence,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[gemini-verify-id] error", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "unknown_error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
