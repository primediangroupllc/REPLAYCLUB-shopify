import { createClient } from 'npm:@supabase/supabase-js@2'
import { resolveSmsFrom } from '../_shared/site-settings.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/twilio'

const sendSms = async (toPhone: string, body: string) => {
  const lovableKey = Deno.env.get('LOVABLE_API_KEY')
  const twilioKey = Deno.env.get('TWILIO_API_KEY')
  const fromNumber = await resolveSmsFrom()
  if (!lovableKey || !twilioKey || !fromNumber) {
    console.warn('SMS skipped — missing Twilio/Lovable credentials')
    return
  }
  const res = await fetch(`${GATEWAY_URL}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      'X-Connection-Api-Key': twilioKey,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: toPhone, From: fromNumber, Body: body }),
  })
  if (!res.ok) {
    const text = await res.text()
    console.error('Twilio send failed', res.status, text)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Find bookings starting in the next 90–150 minutes (cron runs every ~15 min)
  const now = new Date()
  const windowStart = new Date(now.getTime() + 90 * 60 * 1000)
  const windowEnd = new Date(now.getTime() + 150 * 60 * 1000)

  // We need today's and tomorrow's bookings (window may cross midnight in user's TZ; we use local server date keys)
  const dateKeys = new Set<string>()
  dateKeys.add(windowStart.toISOString().split('T')[0])
  dateKeys.add(windowEnd.toISOString().split('T')[0])

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, customer_name, customer_email, customer_phone, room_title, booking_date, booking_time, payment_status')
    .in('payment_status', ['paid', 'promo'])
    .in('booking_date', Array.from(dateKeys))

  if (error) {
    console.error('Failed to fetch bookings', error)
    return new Response(JSON.stringify({ error: error.message }), {
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

  // Filter to those starting inside the 90–150 minute window
  const eligible = bookings.filter((b: any) => {
    const start = new Date(`${b.booking_date}T${b.booking_time}`)
    return start >= windowStart && start <= windowEnd
  })

  if (eligible.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Skip ones already reminded
  const ids = eligible.map((b: any) => b.id)
  const { data: alreadySent } = await supabase
    .from('booking_reminders_2h')
    .select('booking_id')
    .in('booking_id', ids)
  const sentSet = new Set((alreadySent || []).map((r: any) => r.booking_id))
  const toSend = eligible.filter((b: any) => !sentSet.has(b.id))

  // Load preferences for these emails (default: email on, sms off)
  const emails = Array.from(new Set(toSend.map((b: any) => b.customer_email.toLowerCase())))
  const { data: prefsRows } = await supabase
    .from('reminder_preferences')
    .select('user_email, email_enabled, sms_enabled')
    .in('user_email', emails)
  const prefsMap = new Map<string, { email_enabled: boolean; sms_enabled: boolean }>()
  for (const row of prefsRows || []) {
    prefsMap.set((row as any).user_email.toLowerCase(), {
      email_enabled: (row as any).email_enabled,
      sms_enabled: (row as any).sms_enabled,
    })
  }

  let processed = 0
  for (const booking of toSend) {
    const prefs = prefsMap.get(booking.customer_email.toLowerCase()) || {
      email_enabled: true,
      sms_enabled: false,
    }

    try {
      if (prefs.email_enabled) {
        await supabase.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'session-reminder',
            recipientEmail: booking.customer_email,
            idempotencyKey: `session-reminder-2h-${booking.id}`,
            templateData: {
              customerName: booking.customer_name,
              roomTitle: booking.room_title,
              bookingDate: booking.booking_date,
              bookingTime: booking.booking_time,
              hoursUntil: 2,
            },
          },
        })
      }

      if (prefs.sms_enabled && booking.customer_phone) {
        const msg = `Replay Club: Your ${booking.room_title} session starts at ${booking.booking_time}. See you in ~2 hours! Bring a valid photo ID.`
        await sendSms(booking.customer_phone, msg)
      }

      await supabase.from('notifications').insert({
        user_email: booking.customer_email,
        title: 'Session in 2 Hours',
        message: `Your ${booking.room_title} session starts at ${booking.booking_time}. Time to head over!`,
        type: 'reminder',
        booking_id: booking.id,
      })

      await supabase.from('booking_reminders_2h').insert({ booking_id: booking.id })
      processed++
    } catch (err) {
      console.error('2h reminder failed', booking.id, err)
    }
  }

  return new Response(JSON.stringify({ processed, total: toSend.length }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
