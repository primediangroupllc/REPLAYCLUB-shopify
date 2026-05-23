import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookingId, idPhotoPath, customerName } = await req.json();

    if (!bookingId || !idPhotoPath || !customerName) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller's claim on this ID path matches the booking's recorded
    // id_photo_url. Without this, anyone with a bookingId + path can trigger
    // AI verification on someone else's ID photo and mark a booking approved.
    const { data: bookingRow, error: bookingErr } = await supabase
      .from("bookings")
      .select("id_photo_url")
      .eq("id", bookingId)
      .maybeSingle();
    if (bookingErr || !bookingRow || bookingRow.id_photo_url !== idPhotoPath) {
      return new Response(JSON.stringify({ error: "Invalid booking or path" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get a signed URL for the ID photo
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from("id-verification")
      .createSignedUrl(idPhotoPath, 600);

    if (urlError || !signedUrlData?.signedUrl) {
      throw new Error("Failed to get ID photo URL");
    }

    const imageUrl = signedUrlData.signedUrl;

    // Use Lovable AI Gateway to analyze the ID
    const aiResponse = await fetch("https://ai.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an ID verification assistant. Analyze the ID photo and extract information. Respond ONLY with valid JSON, no markdown. The JSON must have these fields:
- "is_valid_id": boolean (true if this appears to be a real government-issued ID like a driver's license, passport, or state ID)
- "is_expired": boolean (true if the ID expiration date has passed, false if still valid or can't determine)
- "extracted_name": string (the full name on the ID, or "" if can't read)
- "is_over_18": boolean (true if the person is 18 or older based on date of birth on the ID)
- "name_match": boolean (true if the extracted name reasonably matches the customer name "${customerName}" — allow for minor differences like middle names, abbreviations, nicknames)
- "confidence": string ("high", "medium", or "low")
- "reason": string (brief explanation of your assessment)`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this ID photo. The booking is under the name "${customerName}". Check if this is a valid government ID, if the person is 18+, and if the name matches.`
              },
              {
                type: "image_url",
                image_url: { url: imageUrl }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI Gateway error:", await aiResponse.text());
      // If AI fails, leave as pending for manual review
      return new Response(JSON.stringify({ status: "pending", reason: "AI analysis unavailable, manual review required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Parse AI response — strip markdown fences if present
    let analysis;
    try {
      const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      analysis = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(JSON.stringify({ status: "pending", reason: "Could not parse ID analysis, manual review required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auto-approve if: valid ID, not expired, over 18, name matches, high/medium confidence
    const autoApprove = 
      analysis.is_valid_id === true &&
      analysis.is_expired === false &&
      analysis.is_over_18 === true &&
      analysis.name_match === true &&
      (analysis.confidence === "high" || analysis.confidence === "medium");

    const newStatus = autoApprove ? "approved" : "pending";

    // Update booking and get details for notification
    const { data: booking } = await supabase
      .from("bookings")
      .update({ id_verified: newStatus })
      .eq("id", bookingId)
      .select("customer_email, customer_name, room_title, booking_date, booking_time")
      .single();

    // Send notification email if auto-approved
    if (autoApprove && booking) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            templateName: "id-verification-result",
            recipientEmail: booking.customer_email,
            idempotencyKey: `id-verified-${bookingId}`,
            templateData: {
              customerName: booking.customer_name,
              roomTitle: booking.room_title,
              bookingDate: booking.booking_date,
              bookingTime: booking.booking_time,
              status: "approved",
            },
          }),
        });
      } catch (emailErr) {
        console.error("ID verification email failed:", emailErr);
      }
    }

    return new Response(JSON.stringify({
      status: newStatus,
      analysis: {
        is_valid_id: analysis.is_valid_id,
        is_over_18: analysis.is_over_18,
        name_match: analysis.name_match,
        confidence: analysis.confidence,
        reason: analysis.reason,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
