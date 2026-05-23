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

  // Find bookings that ended 20-28 hours ago (window for hourly cron)
  const now = new Date()
  const from = new Date(now.getTime() - 28 * 60 * 60 * 1000) // 28 hours ago
  const to = new Date(now.getTime() - 20 * 60 * 60 * 1000)   // 20 hours ago
  const fromDate = from.toISOString().split('T')[0]
  const toDate = to.toISOString().split('T')[0]

  // Get completed bookings in the window
  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('id, customer_name, customer_email, room_title, booking_date, booking_time, payment_status')
    .in('payment_status', ['paid', 'promo'])
    .neq('payment_status', 'cancelled')
    .gte('booking_date', fromDate)
    .lte('booking_date', toDate)

  if (bookingsError) {
    console.error('Failed to fetch bookings', bookingsError)
    return new Response(JSON.stringify({ error: 'Failed to fetch bookings' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!bookings || bookings.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Filter to bookings whose session time has actually passed
  const eligibleBookings = bookings.filter((b: any) => {
    // Parse booking time to check it's in the past
    const timeMatch = b.booking_time?.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
    if (!timeMatch) return true // If we can't parse, include it
    let hour = parseInt(timeMatch[1], 10)
    const min = parseInt(timeMatch[2], 10)
    const isPM = timeMatch[3].toUpperCase() === 'PM'
    if (isPM && hour !== 12) hour += 12
    if (!isPM && hour === 12) hour = 0
    // Add 1.5 hours for session duration
    const sessionEnd = new Date(`${b.booking_date}T${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}:00`)
    sessionEnd.setMinutes(sessionEnd.getMinutes() + 90)
    const hoursSinceEnd = (now.getTime() - sessionEnd.getTime()) / (1000 * 60 * 60)
    return hoursSinceEnd >= 20 && hoursSinceEnd <= 28
  })

  if (eligibleBookings.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Check which already have followups sent
  const bookingIds = eligibleBookings.map((b: any) => b.id)
  const { data: existingFollowups } = await supabase
    .from('booking_followups')
    .select('booking_id')
    .in('booking_id', bookingIds)

  const alreadySent = new Set((existingFollowups || []).map((r: any) => r.booking_id))
  const toFollow = eligibleBookings.filter((b: any) => !alreadySent.has(b.id))

  let processed = 0

  for (const booking of toFollow) {
    try {
      // Try to get referral code for this user
      let referralCode = ''
      const { data: profileData } = await supabase
        .from('profiles')
        .select('referral_code')
        .eq('id', booking.customer_email) // profiles keyed by user id, not email
        // We'll look up by email through auth instead
      
      // Look up user by email to find their profile referral code
      const { data: authData } = await supabase.auth.admin.listUsers()
      if (authData?.users) {
        const user = authData.users.find((u: any) => u.email?.toLowerCase() === booking.customer_email.toLowerCase())
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('referral_code')
            .eq('id', user.id)
            .single()
          if (profile?.referral_code) {
            referralCode = profile.referral_code
          }
        }
      }

      // Format the date nicely
      const dateObj = new Date(booking.booking_date + 'T12:00:00')
      const formattedDate = dateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })

      // Send follow-up email
      await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'post-session-followup',
          recipientEmail: booking.customer_email,
          idempotencyKey: `followup-${booking.id}`,
          templateData: {
            customerName: booking.customer_name,
            roomTitle: booking.room_title,
            bookingDate: formattedDate,
            referralCode,
          },
        },
      })

      // Create in-app notification
      await supabase.from('notifications').insert({
        user_email: booking.customer_email,
        title: 'Thanks for your session!',
        message: `We hope you loved your ${booking.room_title} session. Book again anytime!`,
        type: 'followup',
        booking_id: booking.id,
      })

      // Mark followup as sent
      await supabase.from('booking_followups').insert({
        booking_id: booking.id,
      })

      processed++
      console.log('Follow-up sent for booking', booking.id)
    } catch (err) {
      console.error('Failed to send follow-up for booking', booking.id, err)
    }
  }

  return new Response(JSON.stringify({ processed, total: toFollow.length }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
