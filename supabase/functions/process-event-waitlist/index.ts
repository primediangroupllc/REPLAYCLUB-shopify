import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Promote the next waitlisted RSVP for an event when a confirmed slot opens.
 * - Free events: instantly promote and email confirmation.
 * - Paid events: send "spot is open — claim within 24h" email with a checkout link.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const { eventId } = await req.json();
    if (!eventId) {
      return new Response(JSON.stringify({ error: "Missing eventId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: event } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();

    if (!event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: attendance } = await supabase.rpc("get_event_attendance", {
      p_event_id: eventId,
    });
    const confirmed = (attendance as { confirmed_count?: number } | null)?.confirmed_count ?? 0;
    const slotsOpen = event.capacity - confirmed;

    if (slotsOpen <= 0) {
      return new Response(JSON.stringify({ promoted: 0, reason: "no_slots" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull the next waitlisters by created_at order
    const { data: waitlisters } = await supabase
      .from("event_rsvps")
      .select("*")
      .eq("event_id", eventId)
      .eq("status", "waitlist")
      .order("created_at", { ascending: true })
      .limit(slotsOpen);

    if (!waitlisters || waitlisters.length === 0) {
      return new Response(JSON.stringify({ promoted: 0, reason: "no_waitlisters" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let promoted = 0;
    for (const rsvp of waitlisters) {
      if (event.price_cents > 0) {
        // Paid: just notify — don't auto-confirm. They have to pay.
        // Mark a notification record (to track 24h window) but keep status=waitlist.
        await supabase.from("event_waitlist_notifications").insert({ rsvp_id: rsvp.id });

        try {
          await supabase.functions.invoke("send-event-confirmation", {
            body: { rsvpId: rsvp.id, mode: "waitlist_open" },
          });
        } catch (e) {
          console.error("waitlist email error:", e);
        }
      } else {
        // Free: auto-promote
        const { data: prom } = await supabase
          .from("event_rsvps")
          .update({
            status: "confirmed",
            payment_status: "free",
            promoted_from_waitlist_at: new Date().toISOString(),
          })
          .eq("id", rsvp.id)
          .eq("status", "waitlist")
          .select()
          .single();

        if (prom) {
          promoted++;
          try {
            await supabase.functions.invoke("send-event-confirmation", {
              body: { rsvpId: prom.id, mode: "promoted" },
            });
          } catch (e) {
            console.error("promotion email error:", e);
          }
        }
      }
    }

    return new Response(JSON.stringify({ promoted, notified: waitlisters.length - promoted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("process-event-waitlist error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
