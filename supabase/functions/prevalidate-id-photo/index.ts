import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Pre-flight ID photo check — runs Gemini against an uploaded ID *before*
 * a booking row exists. The client fires this on photo capture and awaits
 * the result at Pay-button click. Output is advisory only: a hard server-side
 * check still runs after payment in `verify-id-photo` (which writes to the
 * booking row). Returns quickly on missing key / model error so the booking
 * flow never blocks on AI.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { idPhotoPath, customerName } = await req.json();
    if (!idPhotoPath || !customerName) {
      return new Response(
        JSON.stringify({ error: "Missing idPhotoPath or customerName" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Identify caller; only authenticated users may pre-validate (the path
    // they send must live under their own user folder).
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: userData } = await admin.auth.getUser(
      authHeader.slice("Bearer ".length),
    );
    const userId = userData?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Path safety: must live under the caller's user folder.
    if (!idPhotoPath.startsWith(`${userId}/`)) {
      return new Response(JSON.stringify({ error: "Path not owned by caller" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: signedUrlData, error: urlError } = await admin.storage
      .from("id-verification")
      .createSignedUrl(idPhotoPath, 600);
    if (urlError || !signedUrlData?.signedUrl) {
      throw new Error("Failed to sign ID photo URL");
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      // Don't fail the booking flow if AI isn't available — return advisory
      // "unknown" so the client treats this as a soft pass.
      return new Response(JSON.stringify({ status: "unknown", reason: "ai_unavailable" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
              "You are an ID document verifier. Decide whether the image clearly shows a government-issued photo ID and whether the printed name plausibly matches the supplied booking name. Reply ONLY by calling the report_id tool — never with prose.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Booking name to compare: "${customerName}". Verify the ID and check the name match.`,
              },
              { type: "image_url", image_url: { url: signedUrlData.signedUrl } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_id",
              description: "Return the ID verification result.",
              parameters: {
                type: "object",
                properties: {
                  is_valid_id: { type: "boolean" },
                  name_match: {
                    type: "string",
                    enum: ["match", "partial", "mismatch", "unreadable"],
                  },
                  reason: { type: "string" },
                },
                required: ["is_valid_id", "name_match", "reason"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_id" } },
      }),
    });

    if (!aiResp.ok) {
      // Soft-fail: log + return unknown so the client doesn't block.
      console.warn("Gemini pre-validate failed:", aiResp.status, await aiResp.text());
      return new Response(
        JSON.stringify({ status: "unknown", reason: `ai_${aiResp.status}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    let parsed: { is_valid_id?: boolean; name_match?: string; reason?: string } = {};
    try {
      parsed = JSON.parse(toolCall?.function?.arguments || "{}");
    } catch {
      parsed = {};
    }

    const status =
      parsed.is_valid_id && (parsed.name_match === "match" || parsed.name_match === "partial")
        ? "ok"
        : parsed.is_valid_id === false
          ? "rejected"
          : "warn";

    return new Response(
      JSON.stringify({
        status,
        is_valid_id: !!parsed.is_valid_id,
        name_match: parsed.name_match || "unreadable",
        reason: parsed.reason || "",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("prevalidate-id-photo error", err);
    // Soft-fail so we never block the user's checkout because of AI hiccups.
    return new Response(
      JSON.stringify({ status: "unknown", reason: "exception" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  }
});
