import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No auth header");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the caller
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      console.error("Auth error:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { mix_id, type } = body;
    if (!mix_id) {
      return new Response(
        JSON.stringify({ error: "mix_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the mix and verify ownership or admin status
    const { data: mix, error: mixError } = await supabase
      .from("mixes")
      .select("id, user_id, file_url, cover_art_url, streaming_url")
      .eq("id", mix_id)
      .single();

    if (mixError || !mix) {
      console.error("Mix not found:", mixError?.message);
      return new Response(
        JSON.stringify({ error: "Mix not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check ownership or admin role
    const isOwner = mix.user_id === user.id;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (!isOwner && !isAdmin) {
      return new Response(
        JSON.stringify({ error: "Access denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Helper: normalize storage path
    const toStoragePath = (raw: string | null): string | null => {
      if (!raw) return null;
      if (!raw.startsWith("http")) return raw;
      try {
        const urlObj = new URL(raw);
        const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/mixes\/(.+)/);
        return pathMatch ? decodeURIComponent(pathMatch[1]) : null;
      } catch {
        return null;
      }
    };

    const signOne = async (raw: string | null): Promise<string | null> => {
      const path = toStoragePath(raw);
      if (!path) return null;
      const { data, error } = await supabase.storage.from("mixes").createSignedUrl(path, 7200);
      if (error || !data) {
        console.error("Sign failed for", path, error?.message);
        return null;
      }
      return data.signedUrl;
    };

    // "all" returns every URL in a single round-trip — much faster for the player
    if (type === "all") {
      const streamingSource = mix.streaming_url || mix.file_url;
      const [streamingUrl, downloadUrl, coverUrl] = await Promise.all([
        signOne(streamingSource),
        mix.streaming_url && mix.file_url && mix.streaming_url !== mix.file_url
          ? signOne(mix.file_url)
          : Promise.resolve(null),
        signOne(mix.cover_art_url),
      ]);

      return new Response(
        JSON.stringify({
          streaming_url: streamingUrl,
          download_url: downloadUrl ?? streamingUrl,
          cover_url: coverUrl,
          has_streaming: !!mix.streaming_url,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Legacy single-URL behavior
    const targetUrl = type === "cover"
      ? mix.cover_art_url
      : type === "streaming"
        ? (mix.streaming_url || mix.file_url)
        : mix.file_url;

    if (!targetUrl) {
      return new Response(
        JSON.stringify({ error: "No file available" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const signedUrl = await signOne(targetUrl);
    if (!signedUrl) {
      return new Response(
        JSON.stringify({ error: "Failed to generate signed URL" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        signed_url: signedUrl,
        has_streaming: !!mix.streaming_url,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
