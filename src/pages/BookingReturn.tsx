import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SeoHead from "@/components/SeoHead";

/**
 * Landing page after Stripe Identity completes (or the user backs out).
 *
 * Stripe redirects here with `?booking_id=…`. We poll the booking row for
 * up to ~20s waiting for the `identity.verification_session.verified`
 * webhook to mark the booking approved, then route the user back to the
 * booking flow / success.
 *
 * This page is intentionally minimal — no auth gate (the user may return
 * in a fresh tab from Stripe), no PII surfaced. Status is read straight
 * from the public-readable bookings columns.
 */
type Status = "checking" | "approved" | "pending" | "rejected" | "missing" | "canceled";

const CANCEL_COUNT_KEY = (id: string) => `id-verify-cancels:${id}`;
const MAX_ID_CANCELS = 3;

const roomTitleToSlug = (title?: string | null): string =>
  (title || "").toLowerCase().replace(/[^a-z0-9]/g, "") || "dj";

const BookingReturn = () => {
  const [params] = useSearchParams();
  const bookingId = params.get("booking_id");
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("checking");
  const [declineReason, setDeclineReason] = useState<string | null>(null);
  // When the inline single-page booking flow started verification, the return
  // URL carries `?return_to=<landing path>`. Only honour a safe same-site
  // relative path (leading `/`, no `//`, no scheme) to avoid open-redirects.
  const returnTo = params.get("return_to");
  const safeReturnTo =
    returnTo && /^\/[A-Za-z0-9/_-]*$/.test(returnTo) && !returnTo.startsWith("//")
      ? returnTo
      : null;
  // Where to resume the booking: the inline landing page (`/dj?resume=…`)
  // when we have a safe return path, else the homepage modal (`/?book=resume…`).
  const resumeTarget = (extra: string) =>
    safeReturnTo
      ? `${safeReturnTo}?resume=${bookingId}${extra}`
      : `/?book=resume&booking=${bookingId}${extra}`;

  useEffect(() => {
    if (!bookingId) {
      setStatus("missing");
      return;
    }
    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      if (cancelled) return;
      const { data } = await supabase
        .from("bookings")
        .select("verification_status, room_title, booking_date, booking_time, customer_email, decline_reason")
        .eq("id", bookingId)
        .maybeSingle();

      const v = data?.verification_status;
      if (v === "approved") {
        setStatus("approved");
        // Slot-conflict check: another customer (or admin) may have booked
        // this exact slot while the user was inside Stripe Identity. If so
        // we must NOT route to Consent — bounce the user back to the date
        // picker with verification preserved (PR 4b slot-conflict slice).
        let slotTaken = false;
        if (
          data?.room_title &&
          data?.booking_date &&
          data?.booking_time &&
          data?.customer_email
        ) {
          const { data: availRows } = await supabase.rpc("check_slot_available", {
            p_room_title: data.room_title,
            p_booking_date: data.booking_date,
            p_booking_time: data.booking_time,
            p_email: data.customer_email,
          });
          const avail = Array.isArray(availRows) ? availRows[0] : availRows;
          if (avail && avail.available === false) slotTaken = true;
        }
        const target = resumeTarget(slotTaken ? "&slot_taken=1" : "");
        setTimeout(() => navigate(target), 1500);
        return;
      }
      if (v === "rejected") {
        // PR — Stripe Identity cancel handling. The webhook marks the
        // booking as rejected with decline_reason="verification_canceled"
        // when the user hits back/X on the Stripe Identity hosted page.
        // Treat that path differently: we want to let the user retry up to
        // 3 times before giving up the slot.
        const isCancel = data?.decline_reason === "verification_canceled";
        if (isCancel) {
          let count = 0;
          try {
            count = Number(sessionStorage.getItem(CANCEL_COUNT_KEY(bookingId)) || "0");
          } catch {}
          count += 1;
          try {
            sessionStorage.setItem(CANCEL_COUNT_KEY(bookingId), String(count));
          } catch {}
          if (count < MAX_ID_CANCELS) {
            // Webhook already deleted the slot lock on canceled, but the
            // booking row is still there. Re-route them back to the modal at
            // the Verify step so they can re-trigger Stripe Identity. The
            // modal will recreate the lock when they advance.
            setStatus("canceled");
            setTimeout(
              () => navigate(resumeTarget("&id_cancelled=1"), { replace: true }),
              900,
            );
            return;
          }
          // 3+ strikes: give up the slot, send them back to the date picker
          // with a "stuck" toast so they can pick a fresh time.
          try {
            sessionStorage.removeItem(CANCEL_COUNT_KEY(bookingId));
          } catch {}
          const slug = roomTitleToSlug(data?.room_title);
          setStatus("canceled");
          const stuckTarget = safeReturnTo
            ? `${safeReturnTo}?id_stuck=1`
            : `/?book=${slug}&step=date&id_stuck=1`;
          setTimeout(() => navigate(stuckTarget, { replace: true }), 900);
          return;
        }
        setDeclineReason(data?.decline_reason ?? null);
        setStatus("rejected");
        return;
      }
      attempts++;
      if (attempts < 10) {
        setTimeout(poll, 2000);
      } else {
        setStatus("pending");
      }
    };
    poll();
    return () => {
      cancelled = true;
    };
  }, [bookingId, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <SeoHead
        title="Verifying your ID — Replay Club"
        description="Confirming your verification result."
      />
      <div className="max-w-md w-full text-center space-y-4">
        {(status === "checking" || status === "canceled") && (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-muted-foreground" />
            <h1 className="text-2xl font-semibold chrome-text">
              {status === "canceled" ? "Returning you to your booking…" : "Confirming your verification…"}
            </h1>
            <p className="text-muted-foreground text-sm">
              This usually takes just a few seconds.
            </p>
          </>
        )}
        {status === "approved" && (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-green-500" />
            <h1 className="text-2xl font-semibold chrome-text">
              Verification approved
            </h1>
            <p className="text-muted-foreground text-sm">
              Taking you to checkout…
            </p>
          </>
        )}
        {status === "rejected" && (
          <>
            <XCircle className="mx-auto h-10 w-10 text-destructive" />
            {declineReason === "dob_mismatch" ? (
              <>
                <h1 className="text-2xl font-semibold chrome-text">
                  Date of birth didn't match
                </h1>
                <p className="text-muted-foreground text-sm">
                  The date of birth on your ID doesn't match what you provided at
                  signup. Your slot has been released. If this was a typo, please
                  contact{" "}
                  <a className="underline" href="mailto:replayclubrecords@gmail.com">
                    replayclubrecords@gmail.com
                  </a>{" "}
                  to update your account and try again.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-semibold chrome-text">
                  Verification could not be completed
                </h1>
                <p className="text-muted-foreground text-sm">
                  If you believe this is an error, please contact{" "}
                  <a
                    className="underline"
                    href="mailto:replayclubrecords@gmail.com"
                  >
                    replayclubrecords@gmail.com
                  </a>
                  .
                </p>
              </>
            )}
            <Link
              to="/"
              className="inline-block mt-4 text-sm underline text-muted-foreground"
            >
              Back to home
            </Link>
          </>
        )}
        {status === "pending" && (
          <>
            <Clock className="mx-auto h-10 w-10 text-muted-foreground" />
            <h1 className="text-2xl font-semibold chrome-text">
              Still processing
            </h1>
            <p className="text-muted-foreground text-sm">
              We'll email you when verification is complete. You can close this
              page.
            </p>
          </>
        )}
        {status === "missing" && (
          <>
            <XCircle className="mx-auto h-10 w-10 text-destructive" />
            <h1 className="text-2xl font-semibold chrome-text">
              No booking reference found
            </h1>
            <Link to="/" className="inline-block mt-2 text-sm underline">
              Back to home
            </Link>
          </>
        )}
      </div>
    </div>
  );
};

export default BookingReturn;