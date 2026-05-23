import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Find mixes expiring in the next 20-28 hours that haven't had a reminder sent
  const now = new Date()
  const from = new Date(now.getTime() + 20 * 60 * 60 * 1000)
  const to = new Date(now.getTime() + 28 * 60 * 60 * 1000)

  const { data: mixes, error: mixesError } = await supabase
    .from('mixes')
    .select('id, title, user_id, expires_at')
    .eq('reminder_sent', false)
    .not('expires_at', 'is', null)
    .gte('expires_at', from.toISOString())
    .lte('expires_at', to.toISOString())

  if (mixesError) {
    console.error('Failed to fetch expiring mixes', mixesError)
    return new Response(JSON.stringify({ error: 'Failed to fetch mixes' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!mixes || mixes.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let processed = 0

  for (const mix of mixes) {
    try {
      // Get user email from auth
      const { data: userData } = await supabase.auth.admin.getUserById(mix.user_id)
      if (!userData?.user?.email) continue

      const userEmail = userData.user.email

      // Get display name from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', mix.user_id)
        .single()

      const expiresDate = new Date(mix.expires_at).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })

      // Send expiry reminder email
      await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'mix-expiring',
          recipientEmail: userEmail,
          idempotencyKey: `mix-expiring-${mix.id}`,
          templateData: {
            displayName: profile?.display_name || undefined,
            mixTitle: mix.title,
            expiresAt: expiresDate,
            profileUrl: 'https://www.replayclub.io/profile',
          },
        },
      })

      // Create in-app notification
      await supabase.from('notifications').insert({
        user_email: userEmail,
        title: 'Mix expiring soon',
        message: `Your mix "${mix.title}" will expire tomorrow. Download it now before it's no longer available.`,
        type: 'mix_expiring',
      })

      // Mark reminder as sent
      await supabase
        .from('mixes')
        .update({ reminder_sent: true })
        .eq('id', mix.id)

      processed++
    } catch (err) {
      console.error(`Failed to process mix ${mix.id}`, err)
    }
  }

  return new Response(JSON.stringify({ processed }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
