import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      sessionInviteId,
      guestName,
      idPhotoPath,
      consentSignaturePath,
      consentSignerName,
    } = await req.json();

    if (!sessionInviteId || !guestName || !idPhotoPath) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Enforce max 2 guests per invite
    const { count } = await supabase
      .from("session_guests")
      .select("id", { count: "exact", head: true })
      .eq("session_invite_id", sessionInviteId);

    if ((count ?? 0) >= 2) {
      return new Response(
        JSON.stringify({
          error: "This session already has 2 guests. Contact the host to request more.",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sign the ID photo for AI to view
    const { data: signed, error: urlError } = await supabase.storage
      .from("id-verification")
      .createSignedUrl(idPhotoPath, 600);

    if (urlError || !signed?.signedUrl) {
      throw new Error("Failed to access uploaded ID photo");
    }

    // Analyze the ID with Lovable AI
    const aiResponse = await fetch("https://ai.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an ID verification assistant. Analyze the ID photo. Respond ONLY with valid JSON, no markdown. Fields:
- "is_valid_id": boolean (real government-issued ID)
- "is_expired": boolean
- "extracted_name": string
- "is_over_18": boolean
- "name_match": boolean (does it reasonably match the guest name "${guestName}" — allow nicknames, middle names, abbreviations)
- "confidence": "high" | "medium" | "low"
- "reason": string`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Verify this ID. Guest name: "${guestName}".`,
              },
              { type: "image_url", image_url: { url: signed.signedUrl } },
            ],
          },
        ],
        max_tokens: 500,
        temperature: 0.1,
      }),
    });

    // Mirror the primary-booker flow: auto-approve when the AI is confident,
    // hard-reject only on clear failures (invalid/expired ID, under 18, or
    // confident name mismatch), and fall back to "pending" for everything
    // else so an admin can review instead of blocking the guest.
    let analysis: any = null;
    let parsed = false;

    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content || "";
      try {
        const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        analysis = JSON.parse(cleaned);
        parsed = true;
      } catch {
        console.error("Failed to parse guest ID AI response:", content);
      }
    } else {
      console.error("AI Gateway error (guest):", await aiResponse.text());
    }

    let status: "approved" | "pending" | "rejected" = "pending";
    let reason = "Manual review pending";

    if (parsed && analysis) {
      const confident = analysis.confidence === "high" || analysis.confidence === "medium";
      const hardFail =
        confident &&
        (analysis.is_valid_id === false ||
          analysis.is_expired === true ||
          analysis.is_over_18 === false ||
          analysis.name_match === false);

      const autoApprove =
        analysis.is_valid_id === true &&
        analysis.is_expired === false &&
        analysis.is_over_18 === true &&
        analysis.name_match === true &&
        confident;

      if (autoApprove) status = "approved";
      else if (hardFail) status = "rejected";
      else status = "pending";

      reason = analysis.reason || reason;
    }

    if (status === "rejected") {
      return new Response(
        JSON.stringify({
          status: "rejected",
          error: "ID could not be verified. " + reason,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Persist a compact AI analysis snapshot so admins can see the reasoning later.
    const analysisSnapshot = parsed && analysis
      ? {
          is_valid_id: analysis.is_valid_id ?? null,
          is_expired: analysis.is_expired ?? null,
          is_over_18: analysis.is_over_18 ?? null,
          name_match: analysis.name_match ?? null,
          extracted_name: analysis.extracted_name ?? null,
          confidence: analysis.confidence ?? null,
          reason: analysis.reason ?? null,
          analyzed_at: new Date().toISOString(),
        }
      : { parsed: false, analyzed_at: new Date().toISOString() };

    // Insert the guest with the AI-determined status (approved or pending).
    const { data: guest, error: insertError } = await supabase
      .from("session_guests")
      .insert({
        session_invite_id: sessionInviteId,
        guest_name: guestName,
        id_photo_path: idPhotoPath,
        id_verified: status,
        id_analysis: analysisSnapshot,
        ...(consentSignaturePath ? { consent_signature_path: consentSignaturePath } : {}),
        ...(consentSignerName ? { consent_signer_name: consentSignerName } : {}),
        ...(consentSignaturePath || consentSignerName
          ? { consent_signed_at: new Date().toISOString() }
          : {}),
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({
        status,
        guest,
        analysis: parsed
          ? {
              is_valid_id: analysis.is_valid_id,
              is_over_18: analysis.is_over_18,
              name_match: analysis.name_match,
              confidence: analysis.confidence,
              reason: analysis.reason,
            }
          : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("verify-guest-id error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
