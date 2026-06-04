import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveSmsFrom, resolveAdminEmails } from "../_shared/site-settings.ts";
import {
  addCustomerTags,
  appendBookingToCustomer,
  findOrCreateCustomer,
  getShopifyAccessToken,
  shopifyConfigured,
} from "../_shared/shopify-admin.ts";
import { refundDuplicateSlotLoser } from "../_shared/duplicate-slot.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-08-27.basil",
});

// Try test secret first, fall back to live secret. This lets the same
// endpoint handle both test-mode and live-mode events from Stripe, which
// sign payloads with different secrets.
const webhookSecretTest = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
const webhookSecretLive = Deno.env.get("STRIPE_WEBHOOK_SECRET_LIVE") || "";

serve(async (req) => {
  // Webhooks are POST only ? no CORS needed (Stripe server-to-server)
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  const replaySecret = req.headers.get("x-replay-secret");
  const isReplay = new URL(req.url).searchParams.get("replay") === "1"
    && replaySecret === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!signature && !isReplay) {
    console.error("Missing stripe-signature header");
    return new Response("Missing signature", { status: 400 });
  }

  let event: Stripe.Event;
  if (isReplay) {
    try {
      event = JSON.parse(body) as Stripe.Event;
    } catch (e) {
      return new Response(`Invalid replay body: ${(e as Error).message}`, { status: 400 });
    }
  } else {
    let constructed: Stripe.Event | null = null;
    let lastErr: unknown = null;
    for (const secret of [webhookSecretTest, webhookSecretLive]) {
      if (!secret) continue;
      try {
        constructed = await stripe.webhooks.constructEventAsync(body, signature!, secret);
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
      }
    }
    if (!constructed) {
      const msg = lastErr instanceof Error ? lastErr.message : "Unknown error";
      console.error("Webhook signature verification failed:", msg);
      // Log signature failures so admins can diagnose key/secret mismatches
      // (e.g. live vs test mode mismatch) from the dashboard instead of
      // having to dig through edge function logs.
      try {
        const sigClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        await sigClient.from("webhook_events").insert({
          source: "stripe",
          event_id: `sig_fail_${crypto.randomUUID()}`,
          event_type: "signature.verification_failed",
          payload: {
            reason: msg,
            signature_header_present: Boolean(signature),
            body_preview: body.slice(0, 500),
          },
          status: "failed",
          error_message: msg,
          attempts: 1,
        });
      } catch (logErr) {
        console.error("Failed to log signature failure:", logErr);
      }
      return new Response(`Webhook Error: ${msg}`, { status: 400 });
    }
    event = constructed;
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Idempotent log: record this delivery attempt up-front. If we've already
  // processed this event_id once, exit early so retries don't double-handle.
  const { data: existingEvent } = await supabase
    .from("webhook_events")
    .select("id, status, attempts")
    .eq("source", "stripe")
    .eq("event_id", event.id)
    .maybeSingle();

  if (existingEvent?.status === "processed" && !isReplay) {
    console.log(`Event ${event.id} already processed ? skipping`);
    await supabase
      .from("webhook_events")
      .update({ attempts: (existingEvent.attempts || 0) + 1 })
      .eq("id", existingEvent.id);
    return new Response(JSON.stringify({ received: true, deduped: true }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }

  await supabase.from("webhook_events").upsert(
    {
      source: "stripe",
      event_id: event.id,
      event_type: event.type,
      payload: event as unknown as Record<string, unknown>,
      status: "received",
      attempts: (existingEvent?.attempts || 0) + 1,
    },
    { onConflict: "source,event_id" },
  );

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.payment_status !== "paid") {
          console.log(`Session ${session.id} not paid yet, skipping`);
          break;
        }

        // Handle gift card purchases
        if (session.metadata?.type === "gift_card") {
          const giftCardId = session.metadata.gift_card_id;
          if (giftCardId) {
            const { error: gcErr } = await supabase
              .from("gift_cards")
              .update({ payment_status: "paid" })
              .eq("id", giftCardId)
              .eq("stripe_session_id", session.id);
            if (gcErr) {
              console.error("Failed to update gift card:", gcErr.message);
            } else {
              console.log(`Gift card ${giftCardId} marked as paid via webhook`);
            }
          }
          break;
        }

        // Handle equipment rental purchases
        if (session.metadata?.type === "equipment_rental") {
          const { data: rental, error: rentErr } = await supabase
            .from("equipment_rentals")
            .update({ payment_status: "paid" })
            .eq("stripe_session_id", session.id)
            .select()
            .single();
          if (rentErr) {
            console.error("Failed to mark rental as paid:", rentErr.message);
          }
          // Release equipment locks now that the rental is paid.
          try {
            const lockIdsRaw = session.metadata?.equipment_lock_ids;
            if (lockIdsRaw) {
              const lockIds = JSON.parse(lockIdsRaw) as string[];
              if (Array.isArray(lockIds) && lockIds.length > 0) {
                await supabase.rpc("release_equipment_locks", { p_lock_ids: lockIds });
              }
            }
          } catch (e) {
            console.error("Failed to release equipment locks:", e);
          }

          // Send rental confirmation email
          if (rental?.id) {
            try {
              const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
              const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
              await fetch(`${supabaseUrl}/functions/v1/send-rental-confirmation`, {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${serviceKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ rentalId: rental.id }),
              });
            } catch (emailError) {
              console.error("Rental confirmation email failed:", emailError);
            }
          }
          break;
        }

        const bookingId = session.metadata?.booking_id;
        if (!bookingId) {
          console.error("No booking_id in session metadata");
          break;
        }

        // Update booking to paid (idempotent ? won't hurt if already paid)
        const { data: booking, error: updateErr } = await supabase
          .from("bookings")
          .update({ payment_status: "paid" })
          .eq("id", bookingId)
          .eq("stripe_session_id", session.id)
          .select()
          .single();

        if (updateErr) {
          // 23505 = bookings_unique_paid_slot_idx fired: this slot already has a
          // paid/promo booking. This customer lost the race and was CHARGED —
          // refund them (idempotent helper) instead of silently stranding them.
          if ((updateErr as { code?: string }).code === "23505") {
            const pi = typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id ?? null;
            // The paid-flip failed, so the row is still in its pre-paid state —
            // read slot + amount for the refund/alert.
            const { data: lost } = await supabase
              .from("bookings")
              .select("room_title, booking_date, booking_time, amount_cents, customer_email")
              .eq("id", bookingId)
              .single();
            await refundDuplicateSlotLoser(stripe, supabase, {
              bookingId,
              paymentIntentId: pi,
              amountCents: lost?.amount_cents ?? session.amount_total ?? 0,
              customerEmail: lost?.customer_email ?? session.customer_details?.email,
              slot: {
                room_title: lost?.room_title,
                booking_date: lost?.booking_date,
                booking_time: lost?.booking_time,
              },
            });
            break;
          }
          // Any other DB error: throw so Stripe retries. Safe now that the
          // webhook_events 'processed' marker (below) makes re-delivery a no-op.
          throw new Error(`Failed to update booking ${bookingId}: ${updateErr.message}`);
        }

        if (!booking) {
          console.error("Booking not found for id:", bookingId);
          break;
        }

        console.log(`Booking ${bookingId} marked as paid via webhook`);

        // Release the slot lock ? booking is now confirmed.
        await supabase
          .from("slot_locks")
          .delete()
          .eq("stripe_session_id", session.id);

        // Deduct gift card balance if used
        const gcId = session.metadata?.gift_card_id;
        const gcDiscountStr = session.metadata?.gift_card_discount_cents;
        if (gcId && gcDiscountStr) {
          const gcDiscount = parseInt(gcDiscountStr, 10);
          if (gcDiscount > 0) {
            const { data: gcData } = await supabase
              .from("gift_cards")
              .select("balance_cents")
              .eq("id", gcId)
              .single();
            if (gcData) {
              const newBalance = Math.max(gcData.balance_cents - gcDiscount, 0);
              await supabase
                .from("gift_cards")
                .update({
                  balance_cents: newBalance,
                  redeemed_at: newBalance <= 0 ? new Date().toISOString() : null,
                  redeemed_by_booking_id: bookingId,
                })
                .eq("id", gcId);
              console.log(`Gift card ${gcId} balance reduced by ${gcDiscount} cents`);
            }
          }
        }

        // Send confirmation SMS ? respect reminder_preferences.sms_enabled
        const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
        const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
        const fromPhone = await resolveSmsFrom();

        let smsAllowed = true;
        try {
          const { data: prefs } = await supabase
            .from("reminder_preferences")
            .select("sms_enabled")
            .ilike("user_email", booking.customer_email)
            .maybeSingle();
          if (prefs && prefs.sms_enabled === false) smsAllowed = false;
        } catch (_) { /* default to allowed */ }

        if (smsAllowed && accountSid && authToken && fromPhone && booking.customer_phone) {
          try {
            await fetch(
              `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
              {
                method: "POST",
                headers: {
                  "Authorization": "Basic " + btoa(`${accountSid}:${authToken}`),
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                  To: booking.customer_phone,
                  From: fromPhone,
                  Body: `? Replay Club Booking Confirmed!\n\n${booking.room_title}\n? ${booking.booking_date} at ${booking.booking_time}\n? $${(booking.amount_cents / 100).toFixed(2)}\n\nSee you there! ?`,
                }),
              }
            );
          } catch (smsError) {
            console.error("SMS confirmation failed:", smsError);
          }
        }

        // Send booking confirmation email
        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          await fetch(`${supabaseUrl}/functions/v1/send-booking-confirmation`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${serviceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ bookingId: booking.id }),
          });
        } catch (emailError) {
          console.error("Email confirmation failed:", emailError);
        }

        // Meta Conversions API ? server-side Purchase event.
        // event_id matches the browser pixel fire on /booking-success so Meta dedupes.
        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          await fetch(`${supabaseUrl}/functions/v1/send-meta-capi-purchase`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${serviceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              eventId: `purchase-${booking.id}`,
              email: booking.customer_email,
              phone: booking.customer_phone,
              valueUsd: (booking.amount_cents ?? 0) / 100,
              currency: "USD",
              contentName: booking.room_title,
              contentCategory: "booking",
            }),
          });
        } catch (capiError) {
          console.error("Meta CAPI Purchase failed:", capiError);
        }

        // Auto-verify ID if uploaded
        if (booking.id_photo_url) {
          try {
            const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
            const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
            await fetch(`${supabaseUrl}/functions/v1/verify-id-photo`, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${serviceKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                bookingId: booking.id,
                idPhotoPath: booking.id_photo_url,
                customerName: booking.customer_name,
              }),
            });
          } catch (idErr) {
            console.error("ID auto-verify failed:", idErr);
          }
        }

        // Notify staff if booking includes a photographer package
        try {
          const PHOTOGRAPHER_PACKAGES = [
            "Basic Photo Package",
            "Professional Photographer Package",
            "Premium Editorial Package",
          ];
          const equipmentArr: string[] = Array.isArray(booking.equipment)
            ? booking.equipment.map((i: unknown) => String(i))
            : [];
          const photogPackage = equipmentArr.find((item) =>
            PHOTOGRAPHER_PACKAGES.includes(item)
          );
          if (photogPackage) {
            const addOns = equipmentArr.filter((item) => item !== photogPackage).join(", ");
            const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
            const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
            const photogAdminEmails = await resolveAdminEmails("replayclubrecords@gmail.com");
            await Promise.all(photogAdminEmails.map((adminEmail) =>
              fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  templateName: "photographer-booking-admin",
                  recipientEmail: adminEmail,
                  idempotencyKey: `photog-alert-${booking.id}-${adminEmail}`,
                  templateData: {
                    customerName: booking.customer_name,
                    customerEmail: booking.customer_email,
                    customerPhone: booking.customer_phone,
                    roomTitle: booking.room_title,
                    bookingDate: booking.booking_date,
                    bookingTime: booking.booking_time,
                    packageName: photogPackage,
                    addOns,
                    amountFormatted: `$${(booking.amount_cents / 100).toFixed(2)}`,
                  },
                }),
              })
            ));
            console.log(`Photographer alert sent for booking ${booking.id}`);
          }
        } catch (photogErr) {
          console.error("Photographer alert failed:", photogErr);
        }

        // Mirror booking history onto the Shopify customer (CRM). Best-effort:
        // a Shopify failure must never affect the booking. Idempotent on replay
        // ? appendBookingToCustomer skips a booking id it has already recorded.
        try {
          if (shopifyConfigured() && booking.customer_email) {
            const [firstName, ...rest] = String(booking.customer_name ?? "")
              .trim()
              .split(/\s+/)
              .filter(Boolean);
            const token = await getShopifyAccessToken();
            const { customer } = await findOrCreateCustomer(token, {
              email: booking.customer_email,
              first_name: firstName || undefined,
              last_name: rest.length ? rest.join(" ") : undefined,
              phone: booking.customer_phone ?? undefined,
            });
            await appendBookingToCustomer(token, customer.id, {
              id: booking.id,
              studio: booking.room_title,
              date: booking.booking_date,
              time: booking.booking_time ?? undefined,
              price: `$${((booking.amount_cents ?? 0) / 100).toFixed(2)}`,
            });
            await addCustomerTags(token, customer.id, ["booked"]);
            console.log(`Shopify: recorded booking ${booking.id} on customer ${customer.id}`);
          }
        } catch (shopErr) {
          console.error("Shopify booking-history write failed:", shopErr);
        }

        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        // Free up the slot so others can book it.
        const { error: lockErr } = await supabase
          .from("slot_locks")
          .delete()
          .eq("stripe_session_id", session.id);
        if (lockErr) {
          console.error("Failed to release expired-session lock:", lockErr.message);
        } else {
          console.log(`Slot lock released for expired session ${session.id}`);
        }
        // Also release equipment locks if this was a rental session
        try {
          const lockIdsRaw = session.metadata?.equipment_lock_ids;
          if (lockIdsRaw) {
            const lockIds = JSON.parse(lockIdsRaw) as string[];
            if (Array.isArray(lockIds) && lockIds.length > 0) {
              await supabase.rpc("release_equipment_locks", { p_lock_ids: lockIds });
              console.log(`Released ${lockIds.length} equipment lock(s) for expired session ${session.id}`);
            }
          }
        } catch (e) {
          console.error("Failed to release equipment locks on expire:", e);
        }
        break;
      }

      case "charge.dispute.created":
      case "charge.dispute.updated":
      case "charge.dispute.closed": {
        const dispute = event.data.object as Stripe.Dispute;
        const paymentIntentId = typeof dispute.payment_intent === "string"
          ? dispute.payment_intent
          : dispute.payment_intent?.id ?? null;
        const chargeId = typeof dispute.charge === "string"
          ? dispute.charge
          : dispute.charge?.id ?? null;

        // Try to map dispute ? booking via stripe_session_id (look up via PI)
        let bookingId: string | null = null;
        let rentalId: string | null = null;
        let rsvpId: string | null = null;
        if (paymentIntentId) {
          try {
            const sessions = await stripe.checkout.sessions.list({ payment_intent: paymentIntentId, limit: 1 });
            const sess = sessions.data[0];
            if (sess) {
              const { data: b } = await supabase.from("bookings").select("id").eq("stripe_session_id", sess.id).maybeSingle();
              if (b) bookingId = b.id;
              if (!bookingId) {
                const { data: r } = await supabase.from("equipment_rentals").select("id").eq("stripe_session_id", sess.id).maybeSingle();
                if (r) rentalId = r.id;
              }
              if (!bookingId && !rentalId) {
                const { data: rs } = await supabase.from("event_rsvps").select("id").eq("stripe_session_id", sess.id).maybeSingle();
                if (rs) rsvpId = rs.id;
              }
            }
          } catch (lookupErr) {
            console.error("Dispute ? booking lookup failed:", lookupErr);
          }
        }

        await supabase.from("stripe_disputes").upsert(
          {
            stripe_dispute_id: dispute.id,
            stripe_payment_intent_id: paymentIntentId,
            stripe_charge_id: chargeId,
            amount_cents: dispute.amount,
            currency: dispute.currency,
            status: dispute.status,
            reason: dispute.reason,
            evidence_due_by: dispute.evidence_details?.due_by
              ? new Date(dispute.evidence_details.due_by * 1000).toISOString()
              : null,
            booking_id: bookingId,
            rental_id: rentalId,
            rsvp_id: rsvpId,
            raw_payload: dispute as unknown as Record<string, unknown>,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "stripe_dispute_id" },
        );

        // Flag the booking
        if (bookingId) {
          await supabase.from("bookings").update({ payment_status: "disputed" }).eq("id", bookingId);
        }

        // Notify admin
        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          const disputeAdminEmails = await resolveAdminEmails("replayclubrecords@gmail.com");
          await Promise.all(disputeAdminEmails.map((adminEmail) =>
            fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
              method: "POST",
              headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                templateName: "booking-failure-admin",
                recipientEmail: adminEmail,
                idempotencyKey: `dispute-${dispute.id}-${event.type}-${adminEmail}`,
                templateData: {
                  stage: `Stripe ${event.type}`,
                  errorMessage: `Dispute ${dispute.id} (${dispute.status}) reason=${dispute.reason} amount=$${(dispute.amount / 100).toFixed(2)}`,
                  customerName: bookingId ? `booking:${bookingId}` : (rentalId ? `rental:${rentalId}` : (rsvpId ? `rsvp:${rsvpId}` : "unknown")),
                  customerEmail: "?",
                },
              }),
            })
          ));
        } catch (notifyErr) {
          console.error("Dispute admin notify failed:", notifyErr);
        }
        break;
      }

      case "identity.verification_session.verified": {
        // Stripe Identity confirmed the document + selfie. We pull DOB/name
        // from the verification report, enforce the 18+ gate, and either
        // approve or reject the booking. Idempotency is handled by the
        // outer webhook_events dedupe ? re-deliveries no-op safely.
        const session = event.data.object as Stripe.Identity.VerificationSession;
        const bookingId = session.metadata?.booking_id;
        if (!bookingId) {
          console.warn("[identity] verified session without booking_id", session.id);
          break;
        }

        // The default object doesn't include the report payload ? fetch it
        // explicitly so we have DOB / name.
        let dob: { day?: number; month?: number; year?: number } | null = null;
        let firstName: string | null = null;
        let lastName: string | null = null;
        let reportFetchFailed = false;
        try {
          const expanded = await stripe.identity.verificationSessions.retrieve(
            session.id,
            { expand: ["last_verification_report"] },
          );
          const report = expanded.last_verification_report as
            | Stripe.Identity.VerificationReport
            | string
            | null;
          if (report && typeof report !== "string") {
            dob = report.document?.dob ?? null;
            firstName = report.document?.first_name ?? null;
            lastName = report.document?.last_name ?? null;
          }
        } catch (rErr) {
          console.error("[identity] failed to retrieve report:", rErr);
          reportFetchFailed = true;
        }

        const dobIso =
          dob?.year && dob?.month && dob?.day
            ? `${dob.year}-${String(dob.month).padStart(2, "0")}-${String(dob.day).padStart(2, "0")}`
            : null;
        const ageYears = dobIso
          ? (Date.now() - new Date(dobIso).getTime()) /
            (365.25 * 24 * 60 * 60 * 1000)
          : null;
        const fullName = `${firstName ?? ""} ${lastName ?? ""}`.trim() || null;

        // Look up the booking once so we can release the slot lock if needed.
        const { data: bookingRow } = await supabase
          .from("bookings")
          .select("id, room_title, booking_date, booking_time, customer_email")
          .eq("id", bookingId)
          .maybeSingle();

        // SAFETY GATE: if the report fetch failed OR DOB is unreadable, do NOT
        // auto-approve. Route to admin manual review so a human inspects the
        // Stripe dashboard. Without this, a transient Stripe API failure leaves
        // ageYears===null, the `< 18` test silently fails, and the else branch
        // approves the booking ? bypassing the age gate.
        if (reportFetchFailed || ageYears === null) {
          // TEST MODE ONLY (event.livemode === false): Stripe Identity test reports
          // carry no real DOB, so ageYears is always null here and every test booking
          // would stall in admin review. Auto-approve test-mode events so the flow is
          // end-to-end testable. LIVE events (real customers) NEVER enter this branch —
          // they fall through to the proper admin-review gate below, age check intact.
          if (event.livemode === false) {
            await supabase.from("id_verifications").update({
              ocr_extracted_dob: dobIso,
              ocr_extracted_name: fullName,
              ocr_raw_response: session as unknown as Record<string, unknown>,
              review_status: "auto_approved",
              rejection_reason: "test_mode_auto_approve",
              reviewed_at: new Date().toISOString(),
            }).eq("booking_id", bookingId);
            await supabase.from("bookings").update({
              verification_status: "approved",
              user_age_tier: "adult_21",
              verification_held_until: null,
            }).eq("id", bookingId);
            console.warn(`[identity] booking ${bookingId} TEST-MODE auto-approved (no DOB in test report)`);
            break;
          }
          await supabase
            .from("id_verifications")
            .update({
              ocr_extracted_dob: dobIso,
              ocr_extracted_name: fullName,
              ocr_raw_response: session as unknown as Record<string, unknown>,
              review_status: "pending",
              rejection_reason: reportFetchFailed
                ? "report_fetch_failed_manual_review"
                : "dob_unreadable_manual_review",
            })
            .eq("booking_id", bookingId);

          // Hold the slot 24h so admin has time to review without losing it.
          const heldUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
          await supabase
            .from("bookings")
            .update({
              verification_status: "pending_admin_review",
              verification_held_until: heldUntil,
            })
            .eq("id", bookingId);

          console.warn(
            `[identity] booking ${bookingId} routed to admin review: ${
              reportFetchFailed ? "report_fetch_failed" : "dob_unreadable"
            }`,
          );
          break;
        }

        // DOB cross-check: the DOB on the government ID must match the DOB the
        // account self-reported at signup (exact day). Only enforced when a stored
        // DOB exists. A mismatch = wrong/borrowed ID or a bad signup DOB; the
        // account's DOB stays editable (not locked until an APPROVED booking), so
        // the user can fix it and retry. Under-18 takes precedence over this.
        let dobMismatch = false;
        if (dobIso && bookingRow?.customer_email) {
          const { data: expectedDob } = await supabase.rpc("profile_dob_for_email", {
            p_email: bookingRow.customer_email,
          });
          if (expectedDob && expectedDob !== dobIso) dobMismatch = true;
        }

        if (ageYears < 18) {
          // Hard reject: 18+ only, no exceptions.
          await supabase
            .from("id_verifications")
            .update({
              ocr_extracted_dob: dobIso,
              ocr_extracted_name: fullName,
              ocr_confidence: 1.0,
              ocr_raw_response: session as unknown as Record<string, unknown>,
              detected_age_tier: "minor_under_18",
              review_status: "auto_approved",
              rejection_reason: "age_under_18",
              reviewed_at: new Date().toISOString(),
            })
            .eq("booking_id", bookingId);

          await supabase
            .from("bookings")
            .update({
              verification_status: "rejected",
              verification_held_until: null,
              decline_reason: "age_under_18",
            })
            .eq("id", bookingId);

          // Release any active slot lock for that exact slot.
          if (bookingRow) {
            await supabase
              .from("slot_locks")
              .delete()
              .eq("room_title", bookingRow.room_title)
              .eq("booking_date", bookingRow.booking_date)
              .eq("booking_time", bookingRow.booking_time);
          }

          console.log(`[identity] booking ${bookingId} rejected: under 18`);
        } else if (dobMismatch) {
          // ID is 18+, but the DOB on the government ID does not match the DOB the
          // account self-reported at signup -> reject. Nothing to refund (no
          // customer charge happens before this step); the slot is released.
          await supabase
            .from("id_verifications")
            .update({
              ocr_extracted_dob: dobIso,
              ocr_extracted_name: fullName,
              ocr_raw_response: session as unknown as Record<string, unknown>,
              review_status: "auto_approved",
              rejection_reason: "dob_mismatch",
              reviewed_at: new Date().toISOString(),
            })
            .eq("booking_id", bookingId);

          await supabase
            .from("bookings")
            .update({
              verification_status: "rejected",
              verification_held_until: null,
              decline_reason: "dob_mismatch",
            })
            .eq("id", bookingId);

          if (bookingRow) {
            await supabase
              .from("slot_locks")
              .delete()
              .eq("room_title", bookingRow.room_title)
              .eq("booking_date", bookingRow.booking_date)
              .eq("booking_time", bookingRow.booking_time);
          }

          console.log(`[identity] booking ${bookingId} rejected: dob_mismatch`);
        } else {
          await supabase
            .from("id_verifications")
            .update({
              ocr_extracted_dob: dobIso,
              ocr_extracted_name: fullName,
              ocr_confidence: 1.0,
              ocr_raw_response: session as unknown as Record<string, unknown>,
              detected_age_tier: "adult_21",
              review_status: "auto_approved",
              reviewed_at: new Date().toISOString(),
            })
            .eq("booking_id", bookingId);

          await supabase
            .from("bookings")
            .update({
              verification_status: "approved",
              user_age_tier: "adult_21",
              verification_held_until: null,
            })
            .eq("id", bookingId);

          console.log(`[identity] booking ${bookingId} approved`);
        }
        break;
      }

      case "identity.verification_session.requires_input": {
        // User abandoned mid-flow or Stripe flagged the document. Don't
        // auto-reject ? the user can retry the same session URL.
        const session = event.data.object as Stripe.Identity.VerificationSession;
        const bookingId = session.metadata?.booking_id;
        if (!bookingId) break;
        await supabase
          .from("id_verifications")
          .update({
            ocr_raw_response: session as unknown as Record<string, unknown>,
            review_status: "pending",
          })
          .eq("booking_id", bookingId);
        console.log(
          `[identity] booking ${bookingId} requires input: ${session.last_error?.code ?? "unknown"}`,
        );
        break;
      }

      case "identity.verification_session.canceled": {
        const session = event.data.object as Stripe.Identity.VerificationSession;
        const bookingId = session.metadata?.booking_id;
        if (!bookingId) break;

        await supabase
          .from("id_verifications")
          .update({
            ocr_raw_response: session as unknown as Record<string, unknown>,
            review_status: "rejected",
            rejection_reason: "session_canceled",
            reviewed_at: new Date().toISOString(),
          })
          .eq("booking_id", bookingId);

        await supabase
          .from("bookings")
          .update({
            verification_status: "rejected",
            verification_held_until: null,
            decline_reason: "verification_canceled",
          })
          .eq("id", bookingId);

        const { data: bookingRow } = await supabase
          .from("bookings")
          .select("room_title, booking_date, booking_time")
          .eq("id", bookingId)
          .maybeSingle();
        if (bookingRow) {
          await supabase
            .from("slot_locks")
            .delete()
            .eq("room_title", bookingRow.room_title)
            .eq("booking_date", bookingRow.booking_date)
            .eq("booking_time", bookingRow.booking_time);
        }

        console.log(`[identity] booking ${bookingId} canceled`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Mark this event processed so the dedupe check at the top actually fires on
    // re-delivery. (Previously nothing ever wrote 'processed', so the guard was
    // dead and Stripe duplicates re-ran the whole handler.)
    await supabase
      .from("webhook_events")
      .update({ status: "processed" })
      .eq("source", "stripe")
      .eq("event_id", event.id);

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook handler error:", err);
    await supabase
      .from("webhook_events")
      .update({
        status: "failed",
        error_message: err instanceof Error ? err.message : String(err),
      })
      .eq("source", "stripe")
      .eq("event_id", event.id);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
