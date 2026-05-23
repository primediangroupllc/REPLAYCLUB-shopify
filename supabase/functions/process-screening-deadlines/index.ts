// Auto-decline bookings whose 24h screening review window has elapsed.
// - Marks screening_status='auto_declined', payment_status='cancelled' (if still pending).
// - Voids any Stripe PaymentIntent authorization on the booking.
// - Releases any active slot_lock for the slot.
// - Sends an apology email via send-transactional-email.
// - Logs the action to screening_review_log.
//
// Idempotent: only acts on bookings where screening_status='pending_review'
// AND screening_review_deadline <= now().
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.3'
// Stripe SDK: match the version used everywhere else in this codebase
// (create-booking-payment etc.). The previous import,
// stripe@14.21.0?target=deno, shipped a Node-compat shim that called
// Deno.core.runMicrotasks() — removed in newer Deno — so every
// invocation crashed. 18.5.0 has no such shim.
import Stripe from 'https://esm.sh/stripe@18.5.0'

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
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  const supabase = createClient(supabaseUrl, serviceKey)
  const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: '2024-06-20' }) : null

  const summary = {
    scanned: 0,
    auto_declined: 0,
    payment_voided: 0,
    emails_sent: 0,
    errors: [] as Array<{ booking_id: string; error: string }>,
  }

  try {
    const { data: due, error } = await supabase
      .from('bookings')
      .select('id, customer_name, customer_email, room_title, booking_date, booking_time, stripe_session_id, payment_status, screening_status, screening_review_deadline')
      .eq('screening_status', 'pending_review')
      .lte('screening_review_deadline', new Date().toISOString())
      .limit(100)

    if (error) throw error
    summary.scanned = due?.length ?? 0

    for (const b of due ?? []) {
      try {
        // 1) Void Stripe PaymentIntent if we have a checkout session and it's still authorized.
        if (stripe && b.stripe_session_id) {
          try {
            const session = await stripe.checkout.sessions.retrieve(b.stripe_session_id)
            const piId = typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent?.id
            if (piId) {
              const pi = await stripe.paymentIntents.retrieve(piId)
              if (pi.status === 'requires_capture') {
                await stripe.paymentIntents.cancel(piId, { cancellation_reason: 'abandoned' })
                summary.payment_voided += 1
              } else if (pi.status === 'succeeded') {
                // Already captured — issue a refund instead.
                await stripe.refunds.create({ payment_intent: piId, reason: 'requested_by_customer' })
                summary.payment_voided += 1
              }
            }
          } catch (stripeErr) {
            // Non-fatal — still mark booking as declined.
            console.error('stripe void failed', b.id, stripeErr)
          }
        }

        // 2) Update booking row.
        const { error: updErr } = await supabase
          .from('bookings')
          .update({
            screening_status: 'auto_declined',
            decline_reason: 'Review window elapsed without admin action.',
            payment_status: b.payment_status === 'paid' ? 'refund_pending' : 'cancelled',
            reviewed_at: new Date().toISOString(),
          })
          .eq('id', b.id)
        if (updErr) throw updErr
        summary.auto_declined += 1

        // 3) Release slot lock for this slot.
        await supabase
          .from('slot_locks')
          .delete()
          .eq('room_title', b.room_title)
          .eq('booking_date', b.booking_date)
          .eq('booking_time', b.booking_time)

        // 4) Audit log.
        await supabase.from('screening_review_log').insert({
          booking_id: b.id,
          actor_id: null,
          action: 'auto_decline',
          reason: 'deadline_elapsed',
        })

        // 5) Apology email.
        try {
          await supabase.functions.invoke('send-transactional-email', {
            body: {
              template: 'booking-screening-declined',
              to: b.customer_email,
              data: {
                customerName: b.customer_name,
                roomTitle: b.room_title,
                bookingDate: b.booking_date,
                bookingTime: b.booking_time,
                reason: 'We were unable to confirm availability within our review window.',
                reapplyUrl: 'https://www.replayclub.io',
              },
            },
          })
          summary.emails_sent += 1
        } catch (emailErr) {
          console.error('apology email failed', b.id, emailErr)
        }
      } catch (bookingErr) {
        summary.errors.push({
          booking_id: b.id,
          error: (bookingErr as Error).message ?? String(bookingErr),
        })
      }
    }

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? String(err), summary }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})