import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Generates waveform data from an audio file by sampling byte ranges.
 * Uses a small number of HTTP Range requests to stay within edge function
 * memory limits, even for very large files (800MB+ WAVs).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mix_id, waveform_data: precomputed } = await req.json();
    if (!mix_id) {
      return new Response(
        JSON.stringify({ error: "mix_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // If pre-computed waveform data is provided, just save it
    if (precomputed && Array.isArray(precomputed) && precomputed.length > 0) {
      const { error } = await supabase
        .from("mixes")
        .update({ waveform_data: precomputed })
        .eq("id", mix_id);
      if (error) throw error;
      return new Response(
        JSON.stringify({ status: "saved", mix_id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the mix record
    const { data: mix, error: fetchError } = await supabase
      .from("mixes")
      .select("id, file_url, waveform_data")
      .eq("id", mix_id)
      .single();

    if (fetchError || !mix) {
      return new Response(
        JSON.stringify({ error: "Mix not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (mix.waveform_data && Array.isArray(mix.waveform_data) && mix.waveform_data.length > 0) {
      return new Response(
        JSON.stringify({ status: "already_computed", mix_id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!mix.file_url) {
      return new Response(
        JSON.stringify({ error: "No file_url on mix" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generating waveform for mix ${mix_id}`);

    let resolvedAudioUrl = mix.file_url;

    if (!mix.file_url.startsWith("http://") && !mix.file_url.startsWith("https://")) {
      const { data: signedData, error: signedError } = await supabase.storage
        .from("mixes")
        .createSignedUrl(mix.file_url, 900);

      if (signedError || !signedData?.signedUrl) {
        throw new Error(`Failed to create signed URL: ${signedError?.message || "unknown error"}`);
      }

      resolvedAudioUrl = signedData.signedUrl;
    }

    // Get file size via HEAD
    const headResp = await fetch(resolvedAudioUrl, { method: "HEAD" });
    if (!headResp.ok) throw new Error(`HEAD failed: ${headResp.status}`);
    const fileSize = Number(headResp.headers.get("content-length") || 0);
    if (!fileSize) throw new Error("Could not determine file size");

    console.log(`File size: ${fileSize} bytes`);

    const bars = 120;
    const headerSkip = Math.min(4096, Math.floor(fileSize * 0.01));
    const dataLength = fileSize - headerSkip;

    // Fetch ~12 evenly-spaced 64KB chunks (~768KB total memory)
    const numChunks = 12;
    const chunkSize = 65536;
    const barsPerChunk = Math.ceil(bars / numChunks);
    const chunkSpacing = Math.floor(dataLength / numChunks);

    const samples: { rms: number; avgDiff: number }[] = Array.from({ length: bars }, () => ({ rms: 0, avgDiff: 0 }));

    for (let c = 0; c < numChunks; c++) {
      const chunkStart = headerSkip + c * chunkSpacing;
      const rangeEnd = Math.min(chunkStart + chunkSize - 1, fileSize - 1);

      let chunk: Uint8Array;
      try {
        const resp = await fetch(resolvedAudioUrl, {
          headers: { Range: `bytes=${chunkStart}-${rangeEnd}` },
        });
        if (!resp.ok && resp.status !== 206) continue;
        chunk = new Uint8Array(await resp.arrayBuffer());
      } catch {
        continue;
      }

      const subSize = Math.max(1, Math.floor(chunk.length / barsPerChunk));

      for (let b = 0; b < barsPerChunk; b++) {
        const barIdx = c * barsPerChunk + b;
        if (barIdx >= bars) break;

        const start = b * subSize;
        const end = Math.min(start + subSize, chunk.length);
        const len = end - start;
        if (len <= 0) continue;

        let sumSq = 0;
        for (let j = start; j < end; j++) {
          const val = (chunk[j] - 128) / 128;
          sumSq += val * val;
        }

        let diffSum = 0;
        for (let j = start + 1; j < end; j++) {
          diffSum += Math.abs(chunk[j] - chunk[j - 1]);
        }

        samples[barIdx] = {
          rms: Math.sqrt(sumSq / len),
          avgDiff: len > 1 ? diffSum / (len - 1) : 0,
        };
      }
    }

    const rawPeaks = samples.map((s) => s.rms);
    const rawVariance = samples.map((s) => s.avgDiff);
    const maxPeak = Math.max(...rawPeaks, 0.001);
    const maxVar = Math.max(...rawVariance, 0.001);

    const waveformData = rawPeaks.map((peak, i) => {
      const np = peak / maxPeak;
      const nv = rawVariance[i] / maxVar;
      const bw = Math.max(0, 1 - nv * 1.5);
      const hw = Math.max(0, nv - 0.3) * 1.5;
      const mw = 1 - bw * 0.5 - hw * 0.5;
      return {
        peak: Math.round(np * 1000) / 1000,
        bass: Math.round(Math.min(1, np * bw) * 1000) / 1000,
        mid: Math.round(Math.min(1, np * mw) * 1000) / 1000,
        high: Math.round(Math.min(1, np * hw) * 1000) / 1000,
      };
    });

    const { error: updateError } = await supabase
      .from("mixes")
      .update({ waveform_data: waveformData })
      .eq("id", mix_id);

    if (updateError) throw updateError;

    console.log(`Waveform saved for mix ${mix_id}`);

    return new Response(
      JSON.stringify({ status: "computed", mix_id, bars: waveformData.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Waveform generation error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
