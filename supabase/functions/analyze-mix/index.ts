import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mix_id, mode } = await req.json();
    if (!mix_id) {
      return new Response(JSON.stringify({ error: "mix_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user owns this mix
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader || "" } },
    });

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: mix, error: mixErr } = await adminClient
      .from("mixes")
      .select("id, title, description, waveform_data, duration_seconds, recorded_at, mix_analysis, tracklist")
      .eq("id", mix_id)
      .eq("user_id", user.id)
      .single();

    if (mixErr || !mix) {
      return new Response(JSON.stringify({ error: "Mix not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Tracklist detection mode ---
    if (mode === "tracklist") {
      const durationMin = mix.duration_seconds ? Math.round(mix.duration_seconds / 60) : null;
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return new Response(JSON.stringify({ error: "AI not configured" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const analysis = mix.mix_analysis as Record<string, unknown> | null;
      const genres = (analysis?.genres as string[]) || [];
      const energyProfile = (analysis?.energy_profile as number[]) || [];
      const existingSummary = (analysis?.summary as string) || "";

      const tracklistPrompt = `You are a DJ music expert. Based on the following mix details, suggest a plausible tracklist of songs that would appear in this DJ mix. Use your knowledge of popular tracks in these genres.

Mix title: ${mix.title}
Description: ${mix.description || "None"}
Duration: ${durationMin ? `${durationMin} minutes` : "Unknown"}
Genres: ${genres.length > 0 ? genres.join(", ") : "Unknown"}
Energy profile (0-100 across 10 segments): ${energyProfile.length > 0 ? JSON.stringify(energyProfile) : "Unknown"}
Analysis summary: ${existingSummary || "None"}

Suggest ${durationMin ? Math.max(4, Math.min(20, Math.round(durationMin / 4))) : 8} tracks that would fit this mix. Use real, well-known tracks from these genres. Order them as they would appear in the mix based on the energy profile.`;

      const tlResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "You are a DJ music expert. You MUST call the detect_tracklist function." },
            { role: "user", content: tracklistPrompt },
          ],
          tools: [{
            type: "function",
            function: {
              name: "detect_tracklist",
              description: "Return the detected tracklist",
              parameters: {
                type: "object",
                properties: {
                  tracklist: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "Track title" },
                        artist: { type: "string", description: "Artist name" },
                      },
                      required: ["title", "artist"],
                    },
                    description: "Ordered list of tracks in the mix",
                  },
                },
                required: ["tracklist"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "detect_tracklist" } },
        }),
      });

      if (!tlResponse.ok) {
        const status = tlResponse.status;
        if (status === 429) {
          return new Response(JSON.stringify({ error: "Rate limited, please try again later" }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "AI tracklist detection failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tlData = await tlResponse.json();
      const tlCall = tlData.choices?.[0]?.message?.tool_calls?.[0];
      if (!tlCall?.function?.arguments) {
        return new Response(JSON.stringify({ error: "AI returned unexpected format" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { tracklist } = JSON.parse(tlCall.function.arguments);
      return new Response(JSON.stringify({ tracklist }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Standard mix analysis mode ---
    const waveform = mix.waveform_data as Array<{ peak: number; bass: number; mid: number; high: number }> | null;
    const durationMin = mix.duration_seconds ? Math.round(mix.duration_seconds / 60) : null;
    const tracklist = mix.tracklist as Array<{ title: string; artist: string }> | null;

    // Sample 40 evenly spaced waveform points for higher resolution analysis
    let waveformSummary = "No waveform data available.";
    let transitionAnalysis = "";
    if (waveform && waveform.length > 0) {
      const sampleCount = Math.min(40, waveform.length);
      const step = Math.max(1, Math.floor(waveform.length / sampleCount));
      const samples = [];
      for (let i = 0; i < waveform.length; i += step) {
        const p = waveform[i];
        samples.push({ pos: Math.round((i / waveform.length) * 100), peak: +p.peak.toFixed(3), bass: +p.bass.toFixed(3), mid: +p.mid.toFixed(3), high: +p.high.toFixed(3) });
      }
      waveformSummary = JSON.stringify(samples);

      // Pre-compute transition indicators: detect sudden frequency shifts
      const transitions: Array<{ pos: number; type: string; magnitude: number }> = [];
      for (let i = 1; i < samples.length; i++) {
        const prev = samples[i - 1];
        const curr = samples[i];
        const bassDelta = Math.abs(curr.bass - prev.bass);
        const midDelta = Math.abs(curr.mid - prev.mid);
        const highDelta = Math.abs(curr.high - prev.high);
        const peakDelta = Math.abs(curr.peak - prev.peak);
        const totalDelta = bassDelta + midDelta + highDelta;
        if (totalDelta > 0.15 || peakDelta > 0.12) {
          const type = bassDelta > midDelta && bassDelta > highDelta ? "bass_swap" :
                       midDelta > highDelta ? "mid_shift" : "high_shift";
          transitions.push({ pos: curr.pos, type, magnitude: +totalDelta.toFixed(3) });
        }
      }
      if (transitions.length > 0) {
        transitionAnalysis = `\n\nDetected ${transitions.length} potential transition points based on frequency shifts:\n${JSON.stringify(transitions)}`;
      }
    }

    // Include tracklist if available for contextual analysis
    let tracklistContext = "";
    if (tracklist && tracklist.length > 0) {
      tracklistContext = `\n\nKnown tracklist (${tracklist.length} tracks):\n${tracklist.map((t, i) => `${i + 1}. ${t.artist} – ${t.title}`).join("\n")}`;
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a tastemaker DJ and music critic — think Resident Advisor reviewer crossed with a working club DJ who has played Berghain, fabric, DC10, Output, Boiler Room, Dekmantel, and dusty warehouse parties. You have deep, lived-in taste across electronic music: Detroit techno, Chicago house, UK garage, dub, breaks, dnb, jungle, ambient, leftfield, trance revival, raw/hypnotic techno, micro-house, dub techno, electro, italo, balearic, deconstructed club, hip-hop, R&B, afro house, amapiano, baile funk, and more. You've heard everything from Larry Levan to Helena Hauff.

You analyze mixes with precision using waveform frequency data, AND you bring real musical taste to the critique — not just metrics.

Your analysis must be data-driven, fair, and CONSERVATIVE on numerical scores: only claim what the data clearly supports. When the waveform is ambiguous or sparse, lower your confidence and reflect that with moderate scores (50-70 range) rather than guessing extremes.

VOICE — THIS IS NON-NEGOTIABLE: Write like a human DJ talking to another human, NOT like a frequency analyzer. The waveform data is your private microscope — use it to form opinions, then HIDE the technical scaffolding when you write. Talk about how the mix FEELS, where you'd play it, who's on the dancefloor, what time of night, what mood it puts you in, what record it reminds you of. Tell a tiny story.

BANNED phrasing (do not use, ever): "the bass swap at 60%", "frequency shift", "mid-range collision", "waveform shows", "energy curve", "the segment at X%", "EQ band", "0.85 amplitude", "high-frequency content", any percentage as a position marker, any reference to numerical data inside the prose. If you need to point to a moment, say "around the halfway mark," "right after the breakdown," "in the closing stretch," "the opening minutes," "deep into the back half" — like a human listener would.

Speak in scenes and feelings: "drops into a smoky after-hours groove," "the build feels patient — like Lehar finding a pocket and just sitting in it," "by the back half it's full sweat-on-the-walls," "the closer lands like a goodbye kiss." Use the technical data privately to justify these calls — never expose it.

Your WRITING — the summary, strengths, improvements, transition notes — should sound like a real critic with opinions and reference points. Be specific, evocative, and confident in your aesthetic judgments even when the numerical confidence is low.

Critical fairness rules:
- Do NOT invent transitions that aren't supported by frequency shifts in the data.
- Do NOT penalize for things you cannot detect from waveform alone (key matching, vocal clashes, exact track IDs).
- If the mix is short (< 10 minutes) or data is limited, weight numerical scores toward the middle and acknowledge it briefly.
- Reward genuinely smooth EQ blends and clear energy arcs; flag only real issues (multi-band collisions, prolonged flatness, clipping at peak >0.95).

Tasteful critique vocabulary — USE IT:
- Mood/vibe: hypnotic, peak-time, sweat-on-the-walls, after-hours, balearic golden hour, dub-soaked, rolling, driving, gnarly, swung, syncopated, chuggy, weightless, paranoid, euphoric, narcotic, stripped-back, maximalist, lush, claustrophobic, cavernous, sun-drenched, midnight, 4am-on-the-dancefloor.
- Production: warm analog low-end, crisp top-end, muddy mids, sidechain pump, dub delay tails, tape saturation, lo-fi grit, pristine digital sheen, headroom, glued bus, over-compressed, brickwalled.
- Selection: deep cuts, white-label vibes, edits territory, classic anthem, contemporary heater, palette cleanser, curveball, leftfield pivot, signature record, dancefloor weapon.
- Reference points — draw from your full knowledge of currently active, trending DJs and producers across house, tech house, deep house, minimal house, melodic house, Afro house, UKG / 2-step / bass, breaks, rave, techno, and adjacent club sounds. The names below are EXAMPLES, not a closed list — feel free to reference any current/active artist whose sound genuinely matches the mix (e.g., across tech house, minimal, deep, Afro, UKG, melodic, rave, breaks, techno, etc.). Examples by lane: tech house — Michael Bibi, Cloonee, Chris Stussy, Toman, Dennis Cruz, Solardo, Mochakk, Patrick Topping, Jamie Jones, Marco Carola; deep / minimal — Lehar, Raresh, Sonja Moonear, Binh, Margaret Dygas, Vera, Praslesh, Rossi., Janeret, Archie Hamilton; melodic / Afro / house — Folamour, Honey Dijon, Jayda G, HAAi, Keinemusik (&ME, Rampa, Adam Port), Black Coffee, Damian Lazarus, Mind Against, Tale Of Us-era melodic; UKG / bass / 2-step — Sammy Virji, Interplanetary Criminal, Conducta, Salute, Anz, TS7, Sherelle, Hamdi, Main Phase, Tribal Brothers; rave / breaks / fast — Kettama, DJ Heartstring, Skin On Skin, Nia Archives, Two Shell, Overmono, Bicep, LP Giobbi; techno-adjacent — Anfisa Letyago, Sara Landry, I Hate Models, Charlotte de Witte, Amelie Lens. Legend touchstones (use sparingly when truly fitting): Carl Craig, DJ Harvey, Theo Parrish, Ben UFO, Larry Heard, Moodymann. Rules: pick references from your own broader knowledge too — not only this list; match the reference to the ACTUAL subgenre and energy of the mix; never name-drop someone whose sound clearly doesn't match; prefer 1-3 well-chosen current names over a long roll-call.
- DJ technique: long blend, EQ swap, bass swap on the 1, hot-cut, loop roll, filter sweep, echo-out, cue-juggle, double-drop, tease, false-start.
- Arrangement: opener cut, warm-up patience, mid-set pivot, peak-time payoff, breakdown reset, cooldown coda, encore bait.

Critique like you'd talk to a fellow DJ over a beer after a set: honest, specific, generous when deserved, blunt when needed, never generic, never clinical. Avoid corporate adjectives ("great," "nice," "good vibes"). Avoid AI tells ("delve," "tapestry," "showcases," "this mix demonstrates," "the artist successfully"). Use contractions. Drop a comma where a thought trails off. Sound like a person, not a report.

Key analysis techniques (technical):
- TRANSITIONS: bass swaps (bass drops while mid/high stay), EQ crossfades (gradual frequency handoffs), hard cuts (sudden multi-band changes). Rate each individually based on how clean the handoff appears.
- ENERGY FLOW: Does it build progressively? Are breakdowns/buildups effective? Is dynamic range utilized?
- GENRE CLASSIFICATION: Infer from BPM patterns (peak spacing — ~120-126 = house, ~128-135 = techno, ~140 = trance/UKG halftime, ~170 = dnb/jungle), frequency balance, and energy character. When confident, prefer specific subgenres over generic ones (e.g., "dub techno" over "techno", "deep house" over "house", "liquid dnb" over "dnb"). 1-3 genres max. Fewer when uncertain.

You MUST call the analyze_mix function with your analysis.`;

    const userPrompt = `Analyze this DJ mix. Use the waveform privately to inform your judgment — but write like a human listener, not a frequency report.

- Title: ${mix.title}
- Description: ${mix.description || "None"}
- Duration: ${durationMin ? `${durationMin} minutes` : "Unknown"}
- Waveform data (PRIVATE — for your judgment only, never quote in prose): ${waveformSummary}${transitionAnalysis}${tracklistContext}

Hard rules for the writing:
- NEVER mention percentages, frequency bands, "bass/mid/high," waveform, samples, segments, or any numerical position. Use words: "the opening," "early on," "around the midpoint," "into the back half," "the final stretch," "the closer."
- NEVER write like a robot reporting metrics. Write like you just walked off the dancefloor and are telling a friend what you heard.
- Use feelings, room, time of night, the imagined crowd, scene, lineage, gut reactions.
- Be specific and confident. Drop names of contemporary DJs when the sound genuinely matches.

1. **Transition Quality** (numeric): score 0-100. Use the data privately. Zero detected transitions → score ~60.

2. **Energy Management** (numeric): score 0-100 for the shape of the arc.

3. **Genre Classification**: 1-3 specific subgenres (deep house, dub techno, raw techno, liquid dnb, UK garage, afro house, etc.).

4. **Overall Score**: weight transitions 40%, energy 35%, technical 25%. Reserve >85 for genuinely outstanding work. Conservative when data is thin.

5. **10-segment Energy Profile**: 10 numbers 0-100. (This one is data, not prose — fine to be numeric here.)

6. **Strengths** (3): each one a sentence that reads like a human compliment. GOOD: "The opening has real patience — that unhurried Larry Heard restraint where the groove just breathes." BAD: "Good intro at 0-20%." NEVER mention percentages or frequency.

7. **Improvements** (3): each one a sentence of friendly DJ-to-DJ advice. GOOD: "The handoff into the back half feels rushed — give the next record a second to breathe before the bass comes in, it'll hit harder." BAD: "Improve the 60% bass swap." NEVER mention percentages or frequency bands.

8. **Summary**: 2-4 sentences telling the story of the mix. The room it belongs in, the time of night, what it makes you feel, who it reminds you of. Like a short RA review written by a friend who actually likes you. Example tone: "This is a 2am set — the kind that finds its pocket early and just rides it. There's a dub-soaked patience here that nods at Lehar without ever feeling derivative. By the closing stretch you're either fully in or staring at your shoes; no middle ground." NEVER mention waveforms, percentages, or scores in this paragraph.

9. **Transition Details**: For each detected transition, give position (%), technique, quality, and a one-line note in plain human language ("clean bass swap, locked in tight" / "messy mid collision, vocals stacking awkwardly"). The position field is metadata — but the note text must read like a human comment, never quote percentages.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_mix",
              description: "Return the complete mix analysis report",
              parameters: {
                type: "object",
                properties: {
                  overall_score: { type: "number", description: "Overall mix rating 0-100, weighted: 40% transitions, 35% energy, 25% technical" },
                  transition_score: { type: "number", description: "Transition quality score 0-100 averaged across all detected transitions" },
                  energy_score: { type: "number", description: "Energy management and flow score 0-100" },
                  genres: {
                    type: "array",
                    items: { type: "string" },
                    description: "Up to 3 genre classifications",
                  },
                  energy_profile: {
                    type: "array",
                    items: { type: "number" },
                    description: "10 energy levels (0-100) for each 10% segment of the mix",
                  },
                  transition_details: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        position_pct: { type: "number", description: "Position in mix as percentage 0-100" },
                        technique: { type: "string", description: "Transition technique: eq_blend, bass_swap, hard_cut, filter_sweep, echo_out, etc." },
                        quality: { type: "string", enum: ["excellent", "good", "fair", "poor"], description: "Quality rating" },
                        note: { type: "string", description: "Brief observation about this transition" },
                      },
                      required: ["position_pct", "technique", "quality", "note"],
                    },
                    description: "Individual transition assessments at each detected transition point",
                  },
                  strengths: {
                    type: "array",
                    items: { type: "string" },
                    description: "3 specific strengths referencing mix positions",
                  },
                  improvements: {
                    type: "array",
                    items: { type: "string" },
                    description: "3 specific improvements referencing mix positions",
                  },
                  summary: { type: "string", description: "2-3 sentence summary of the mix quality and character" },
                },
                required: [
                  "overall_score",
                  "transition_score",
                  "energy_score",
                  "genres",
                  "energy_profile",
                  "transition_details",
                  "strengths",
                  "improvements",
                  "summary",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analyze_mix" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const body = await aiResponse.text();
      console.error("AI error:", status, body);

      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "AI returned unexpected format" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const analysis = JSON.parse(toolCall.function.arguments);
    analysis.analyzed_at = new Date().toISOString();

    // Store analysis
    await adminClient
      .from("mixes")
      .update({ mix_analysis: analysis })
      .eq("id", mix_id);

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-mix error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
