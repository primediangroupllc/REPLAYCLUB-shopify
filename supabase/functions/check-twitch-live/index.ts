import { resolveTwitchChannel } from '../_shared/site-settings.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/twitch';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const TWITCH_API_KEY = Deno.env.get('TWITCH_API_KEY');
  if (!TWITCH_API_KEY) {
    return new Response(JSON.stringify({ error: 'TWITCH_API_KEY not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const channel = await resolveTwitchChannel('REPLAYCLUB_');
    const response = await fetch(`${GATEWAY_URL}/streams?user_login=${encodeURIComponent(channel)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': TWITCH_API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Twitch API error [${response.status}]: ${errorText}`);
    }

    const data = await response.json();
    const isLive = data.data && data.data.length > 0;
    const streamInfo = isLive ? {
      title: data.data[0].title,
      viewer_count: data.data[0].viewer_count,
      game_name: data.data[0].game_name,
      thumbnail_url: data.data[0].thumbnail_url,
      started_at: data.data[0].started_at,
    } : null;

    return new Response(JSON.stringify({ is_live: isLive, stream: streamInfo }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
    });
  } catch (error) {
    console.error('Twitch live check error:', error);
    return new Response(JSON.stringify({ is_live: false, error: String(error) }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
