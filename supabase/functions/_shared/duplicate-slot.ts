// Race-loser handler for studio-slot double-booking.
//
// A customer can pay for a slot that another paid booking has already won: the
// partial unique index `bookings_unique_paid_slot_idx` (room_title, booking_date,
// booking_time) WHERE payment_status IN ('paid','promo') rejects the second
// paid-flip with Postgres error 23505. Without this, the loser is charged with no
// booking, no refund, and no signal. Both paid-flip doors (stripe-webhook and
// verify-booking-payment) call this on 23505.
//
// ARBITRATION POLICY (deliberate): the first paid booking to COMMIT keeps the
// slot; the 23505 loser is fully refunded. Commit order == webhook/verify arrival
// order — acceptable for a studio slot (no business reason to prefer the earlier
// lock-acquirer over the earlier-confirmed payment).
//
// Idempotent on two independent layers, so a duplicate webhook delivery OR the
// webhook + verify-booking-payment both firing can't double-refund:
//   (1) DB claim — flip to 'duplicate_void' only from a non-terminal status. A
//       second caller gets no row back and no-ops.
//   (2) Stripe idempotency key (keyed on the PaymentIntent) — at most one refund
//       even if two callers slip past the claim concurrently.

import type Stripe from "https://esm.sh/stripe@18.5.0";

export interface DuplicateSlotContext {
  bookingId: string;
  paymentIntentId: string | null;
  amountCents: number;
  customerEmail?: string | null;
  slot: {
    room_title?: string | null;
    booking_date?: string | null;
    booking_time?: string | null;
  };
}

export async function refundDuplicateSlotLoser(
  stripe: Stripe,
  // deno-lint-ignore no-explicit-any
  supabase: any,
  ctx: DuplicateSlotContext,
): Promise<{ handled: boolean; refunded: boolean }> {
  // (1) Claim. Only void a booking that hasn't already reached a terminal state;
  //     a concurrent delivery that already claimed it gets no row back.
  const { data: claimed } = await supabase
    .from("bookings")
    .update({ payment_status: "duplicate_void" })
    .eq("id", ctx.bookingId)
    .not("payment_status", "in", "(paid,promo,refunded,duplicate_void)")
    .select("id")
    .maybeSingle();

  if (!claimed) return { handled: false, refunded: false }; // already handled elsewhere

  // (2) Refund — keyed on the PaymentIntent so retries can't double-refund.
  let refunded = false;
  if (ctx.paymentIntentId) {
    try {
      await stripe.refunds.create(
        { payment_intent: ctx.paymentIntentId, reason: "duplicate" },
        { idempotencyKey: `dup-refund-${ctx.paymentIntentId}` },
      );
      refunded = true;
      await supabase
        .from("bookings")
        .update({ refund_status: "processed", refunded_amount_cents: ctx.amountCents })
        .eq("id", ctx.bookingId);
    } catch (refundErr) {
      // Leave it 'duplicate_void' + raise the alert so an admin refunds manually.
      console.error(`[dup-slot] refund FAILED for booking ${ctx.bookingId}:`, refundErr);
    }
  } else {
    console.error(`[dup-slot] no PaymentIntent for booking ${ctx.bookingId} — manual refund needed`);
  }

  // (3) Admin alert — machine-readable audit row (best-effort).
  try {
    await supabase.from("audit_log").insert({
      admin_user_id: null,
      action: "duplicate_slot_refund",
      entity_type: "booking",
      entity_id: ctx.bookingId,
      details: {
        ...ctx.slot,
        payment_intent: ctx.paymentIntentId,
        amount_cents: ctx.amountCents,
        refunded,
        customer_email: ctx.customerEmail ?? null,
      },
    });
  } catch (auditErr) {
    console.error("[dup-slot] audit_log insert failed:", auditErr);
  }

  return { handled: true, refunded };
}
