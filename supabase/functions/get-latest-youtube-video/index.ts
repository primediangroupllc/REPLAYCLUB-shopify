const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const HANDLE = 'replayclublive';
const FALLBACK_VIDEO_ID = 'RTyftA9g5vI';

// In-memory cache (per edge function instance)
let cache: { videoId: string; title?: string; expiresAt: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Extract a YouTube video ID from any of the common URL/ID shapes:
 *   - bare ID:                   "RTyftA9g5vI"
 *   - watch URL:                 "https://www.youtube.com/watch?v=RTyftA9g5vI&t=10s"
 *   - youtu.be short URL:        "https://youtu.be/RTyftA9g5vI"
 *   - /shorts/ URL:              "https://www.youtube.com/shorts/RTyftA9g5vI"
 *   - /embed/ URL:               "https://www.youtube.com/embed/RTyftA9g5vI"
 *   - /live/ URL:                "https://www.youtube.com/live/RTyftA9g5vI"
 */
function parseYouTubeId(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const v = url.searchParams.get('v');
    if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
    const parts = url.pathname.split('/').filter(Boolean);
    for (let i = 0; i < parts.length; i++) {
      if (['shorts', 'embed', 'live', 'v'].includes(parts[i]) && parts[i + 1]) {
        const cand = parts[i + 1];
        if (/^[A-Za-z0-9_-]{11}$/.test(cand)) return cand;
      }
    }
    if (url.hostname.endsWith('youtu.be') && parts[0] && /^[A-Za-z0-9_-]{11}$/.test(parts[0])) {
      return parts[0];
    }
  } catch { /* fall through */ }
  return null;
}

async function getOverrideVideoId(): Promise<string | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) return null;
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/site_settings?select=latest_video_url&id=eq.1`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
      },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ latest_video_url: string | null }>;
    return parseYouTubeId(rows?.[0]?.latest_video_url ?? null);
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 1) Manual admin override always wins. Bypasses cache so admins see edits
  //    instantly. The override is itself just a pinned video ID, so the
  //    response is small/fast.
  const overrideId = await getOverrideVideoId();
  if (overrideId) {
    return new Response(
      JSON.stringify({ video_id: overrideId, source: 'override' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30' } }
    );
  }

  const apiKey = Deno.env.get('YOUTUBE_API_KEY');
  if (!apiKey) {
    return new Response(
      JSON.stringify({ video_id: FALLBACK_VIDEO_ID, error: 'YOUTUBE_API_KEY not configured' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Serve from cache
  if (cache && cache.expiresAt > Date.now()) {
    return new Response(
      JSON.stringify({ video_id: cache.videoId, title: cache.title, cached: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60, s-maxage=600' } }
    );
  }

  try {
    // Step 1: Resolve handle -> channelId
    const channelRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&forHandle=@${HANDLE}&key=${apiKey}`
    );
    if (!channelRes.ok) {
      throw new Error(`channels API ${channelRes.status}: ${await channelRes.text()}`);
    }
    const channelData = await channelRes.json();
    const uploadsPlaylistId = channelData?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) {
      throw new Error('Could not resolve uploads playlist for @' + HANDLE);
    }

    // Step 2: Fetch recent videos from uploads playlist
    const playlistRes = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=15&playlistId=${uploadsPlaylistId}&key=${apiKey}`
    );
    if (!playlistRes.ok) {
      throw new Error(`playlistItems API ${playlistRes.status}: ${await playlistRes.text()}`);
    }
    const playlistData = await playlistRes.json();
    const items: any[] = playlistData?.items ?? [];
    const candidateIds: string[] = items
      .map((i) => i?.snippet?.resourceId?.videoId)
      .filter(Boolean);

    if (candidateIds.length === 0) {
      throw new Error('No videos found in uploads playlist');
    }

    // Step 3: Filter out live broadcasts (live or recently ended) — only return regular VODs
    const videosRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails,status&id=${candidateIds.join(',')}&key=${apiKey}`
    );
    if (!videosRes.ok) {
      throw new Error(`videos API ${videosRes.status}: ${await videosRes.text()}`);
    }
    const videosData = await videosRes.json();
    const videos: any[] = videosData?.items ?? [];

    // Helpers
    const isCurrentlyLive = (v: any) =>
      v?.snippet?.liveBroadcastContent && v.snippet.liveBroadcastContent !== 'none';
    const isEmbeddablePublic = (v: any) =>
      v?.status?.embeddable !== false && v?.status?.privacyStatus === 'public';
    const hasLiveDetails = (v: any) => !!v?.liveStreamingDetails;

    // Preference 1: regular uploaded VODs (never were a livestream)
    let pick = videos.find(
       (v) => !isCurrentlyLive(v) && !hasLiveDetails(v) && isEmbeddablePublic(v)
    );

    // Preference 2: past livestreams that ended >= 24h ago (VOD should be processed by then)
    if (!pick) {
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      pick = videos.find((v) => {
        if (isCurrentlyLive(v) || !isEmbeddablePublic(v)) return false;
        const ended = v?.liveStreamingDetails?.actualEndTime;
        return ended && new Date(ended).getTime() < cutoff;
      });
    }

    // Preference 3: any past livestream that has ended (>= 1h) — last resort
    if (!pick) {
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      pick = videos.find((v) => {
        if (isCurrentlyLive(v) || !isEmbeddablePublic(v)) return false;
        const ended = v?.liveStreamingDetails?.actualEndTime;
        return ended && new Date(ended).getTime() < oneHourAgo;
      });
    }

    const videoId = pick?.id ?? candidateIds[0];
    const title = pick?.snippet?.title ?? items[0]?.snippet?.title;


    cache = { videoId, title, expiresAt: Date.now() + CACHE_TTL_MS };

    return new Response(
      JSON.stringify({ video_id: videoId, title, cached: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60, s-maxage=600' } }
    );
  } catch (error) {
    console.error('get-latest-youtube-video error:', error);
    return new Response(
      JSON.stringify({ video_id: FALLBACK_VIDEO_ID, error: String(error) }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
