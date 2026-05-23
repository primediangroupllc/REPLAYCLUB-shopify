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

  // Find bookings happening in the next 20-28 hours that haven't had a reminder sent
  // Using a window to account for cron frequency
  const now = new Date()
  const from = new Date(now.getTime() + 20 * 60 * 60 * 1000) // 20 hours from now
  const to = new Date(now.getTime() + 28 * 60 * 60 * 1000) // 28 hours from now
  const fromDate = from.toISOString().split('T')[0]
  const toDate = to.toISOString().split('T')[0]

  // Get bookings in the date range that are paid or promo
  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('id, customer_name, customer_email, room_title, booking_date, booking_time, payment_status')
    .in('payment_status', ['paid', 'promo'])
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

  // Check which ones already have reminders
  const bookingIds = bookings.map((b: any) => b.id)
  const { data: existingReminders } = await supabase
    .from('booking_reminders')
    .select('booking_id')
    .in('booking_id', bookingIds)

  const alreadyReminded = new Set((existingReminders || []).map((r: any) => r.booking_id))
  const toRemind = bookings.filter((b: any) => !alreadyReminded.has(b.id))

  let processed = 0

  for (const booking of toRemind) {
    try {
      // Send email reminder
      await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'session-reminder',
          recipientEmail: booking.customer_email,
          idempotencyKey: `session-reminder-${booking.id}`,
          templateData: {
            customerName: booking.customer_name,
            roomTitle: booking.room_title,
            bookingDate: booking.booking_date,
            bookingTime: booking.booking_time,
          },
        },
      })

      // Create in-app notification
      await supabase.from('notifications').insert({
        user_email: booking.customer_email,
        title: 'Session Tomorrow!',
        message: `Your ${booking.room_title} session is tomorrow at ${booking.booking_time}. Don't forget to bring a valid photo ID!`,
        type: 'reminder',
        booking_id: booking.id,
      })

      // Mark reminder as sent
      await supabase.from('booking_reminders').insert({
        booking_id: booking.id,
      })

      processed++
      console.log('Reminder sent for booking', booking.id)
    } catch (err) {
      console.error('Failed to send reminder for booking', booking.id, err)
    }
  }

  return new Response(JSON.stringify({ processed, total: toRemind.length }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
