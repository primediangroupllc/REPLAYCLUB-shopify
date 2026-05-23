import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Users, Copy, Check, QrCode, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import SocialShareCard from "@/components/SocialShareCard";
import { reportBookingFailure } from "@/lib/bookingFailureReporter";
import { QRCodeSVG } from "qrcode.react";
import { trackPurchase, getMetaCookies } from "@/lib/metaPixel";

// Build an .ics calendar event from a Replay Club booking. Returns a
// downloadable Blob URL. Works in Apple Calendar, Outlook, Google
// Calendar (via "Add file"), and any other ICS-compatible client.
const buildBookingIcs = (booking: {
  id: string;
  room_title: string;
  booking_date: string;
  booking_time: string;
}): string => {
  const time = booking.booking_time || "";
  const m = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  let startHour = 14;
  let startMin = 0;
  if (m) {
    startHour = parseInt(m[1], 10);
    startMin = parseInt(m[2], 10);
    if (m[3].toUpperCase() === "PM" && startHour !== 12) startHour += 12;
    if (m[3].toUpperCase() === "AM" && startHour === 12) startHour = 0;
  }
  // Default to a 2-hour event; matches the studio minimum + most bookings.
  const endHour = startHour + 2;
  const datePart = booking.booking_date.replace(/-/g, "");
  const pad = (n: number) => n.toString().padStart(2, "0");
  const startDt = `${datePart}T${pad(startHour)}${pad(startMin)}00`;
  const endDt = `${datePart}T${pad(endHour)}${pad(startMin)}00`;
  const now = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .split(".")[0] + "Z";
  const esc = (s: string) =>
    s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Replay Club//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${booking.id}@replayclub.io`,
    `DTSTAMP:${now}`,
    `DTSTART;TZID=America/Los_Angeles:${startDt}`,
    `DTEND;TZID=America/Los_Angeles:${endDt}`,
    `SUMMARY:${esc(`Replay Club — ${booking.room_title}`)}`,
    `DESCRIPTION:${esc(
      "Your Replay Club session.\nPickup: 14521 Friar St, Van Nuys, CA 91411 — escort meets you and walks you to the studio. Arrive 5–10 min early. Valid photo ID required.",
    )}`,
    "LOCATION:Replay Club Pickup Point, 14521 Friar St, Van Nuys, CA 91411",
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Your Replay Club session is in 1 hour",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
};

const BookingSuccess = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const bookingId = searchParams.get("booking_id");
  const isGiftCardPayment = searchParams.get("gift_card") === "true";
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessionLink, setSessionLink] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);

  useEffect(() => {
    const checkBooking = async () => {
      if ((!sessionId && !isGiftCardPayment) || !bookingId) {
        setError("Missing booking information");
        setLoading(false);
        return;
      }

      // Gift card fully covered payment — booking is already paid
      if (isGiftCardPayment && bookingId) {
        const { data, error: fetchErr } = await supabase
          .from("bookings")
          .select("*")
          .eq("id", bookingId)
          .single();
        if (!fetchErr && data) {
          setBooking(data);
        } else {
          setError("Could not find booking details.");
        }
        setLoading(false);
        return;
      }

      // Poll for the booking to be marked as paid by the webhook
      // Try up to 10 times with 2s intervals (20s total)
      let attempts = 0;
      const maxAttempts = 10;

      const poll = async (): Promise<boolean> => {
        const { data, error: fetchErr } = await supabase
          .from("bookings")
          .select("*")
          .eq("id", bookingId)
          .eq("stripe_session_id", sessionId)
          .single();

        if (fetchErr || !data) return false;

        if (data.payment_status === "paid") {
          setBooking(data);
          return true;
        }
        return false;
      };

      // First check immediately
      if (await poll()) {
        setLoading(false);
        return;
      }

      // Then poll with interval
      const interval = setInterval(async () => {
        attempts++;
        if (await poll() || attempts >= maxAttempts) {
          clearInterval(interval);
          if (!booking && attempts >= maxAttempts) {
            // Fallback: try the verify function directly
            try {
              const { data } = await supabase.functions.invoke("verify-booking-payment", {
                body: { sessionId, bookingId },
              });
              if (data?.success && data?.booking) {
                setBooking(data.booking);
              } else {
                setError("Payment is being processed. You'll receive a confirmation email shortly.");
                reportBookingFailure({
                  stage: "verify-booking-payment",
                  error: new Error(data?.error || "Verification did not return a paid booking"),
                  stripeSessionId: sessionId,
                  bookingId: bookingId,
                });
              }
            } catch (verifyErr) {
              setError("Payment is being processed. You'll receive a confirmation email shortly.");
              reportBookingFailure({
                stage: "verify-booking-payment",
                error: verifyErr,
                stripeSessionId: sessionId,
                bookingId: bookingId,
              });
            }
          }
          setLoading(false);
        }
      }, 2000);

      return () => clearInterval(interval);
    };

    setError("");
    setLoading(true);
    checkBooking();
  }, [sessionId, bookingId, retryAttempt]);

  // Create session invite when booking is confirmed
  useEffect(() => {
    if (!booking) return;
    const createInvite = async () => {
      // Check if invite already exists
      const { data: existingArr } = await supabase
        .rpc("get_session_invite_by_booking", { p_booking_id: booking.id });
      const existing = existingArr?.[0] || null;

      if (existing) {
        setSessionLink(`${window.location.origin}/session/${existing.token}`);
        return;
      }

      const { data, error } = await supabase
        .from("session_invites")
        .insert({
          booking_id: booking.id,
          created_by_name: booking.customer_name,
          room_title: booking.room_title,
          booking_date: booking.booking_date,
          booking_time: booking.booking_time,
        })
        .select("token")
        .single();

      if (!error && data) {
        setSessionLink(`${window.location.origin}/session/${data.token}`);
      }
    };
    createInvite();
  }, [booking]);

  // Fire Meta Pixel Purchase + server-side CAPI Purchase exactly once per
  // confirmed booking. event_id is shared so Meta can dedupe browser + server hits.
  useEffect(() => {
    if (!booking || booking.payment_status !== "paid") return;
    const eventId = `purchase-${booking.id}`;
    const valueUsd = (booking.amount_cents ?? 0) / 100;
    const contentName = booking.room_title;

    // Browser pixel
    trackPurchase({
      eventId,
      valueUsd,
      contentName,
      contentCategory: "booking",
    });

    // Server-side CAPI (no-op if pixel/token not yet configured in admin)
    const cookies = getMetaCookies();
    supabase.functions.invoke("send-meta-capi-purchase", {
      body: {
        eventId,
        email: booking.customer_email,
        phone: booking.customer_phone,
        valueUsd,
        currency: "USD",
        contentName,
        contentCategory: "booking",
        sourceUrl: typeof window !== "undefined" ? window.location.href : undefined,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        fbp: cookies.fbp,
        fbc: cookies.fbc,
      },
    }).catch(() => { /* non-blocking */ });
  }, [booking]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="chrome-surface border border-border depth-shadow-lg rounded-lg p-8 max-w-md w-full text-center"
      >
        <img src={logo} alt="Replay Club" className="h-16 mx-auto mb-6" />

        {loading ? (
          <div className="space-y-4">
            <div className="w-8 h-8 border-2 border-chrome border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-muted-foreground font-body text-sm">Confirming your booking...</p>
          </div>
        ) : error ? (
          <div className="space-y-4">
            <div className="text-4xl mb-4">⏳</div>
            <h1 className="font-display text-xl font-bold chrome-text">Almost There</h1>
            <p className="text-muted-foreground font-body text-sm">{error}</p>
            <p className="text-muted-foreground/70 font-body text-[11px]">
              If your card was charged but you don't get a confirmation email within a few minutes,
              tap retry — or email <a className="underline" href="mailto:replayclubrecords@gmail.com">replayclubrecords@gmail.com</a> with your booking ID.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
              <button
                onClick={() => setRetryAttempt((n) => n + 1)}
                className="inline-block chrome-btn font-display font-semibold text-xs uppercase tracking-[0.15em] px-6 py-3 rounded-md"
              >
                Try Again
              </button>
              <Link
                to="/"
                className="inline-block font-display font-semibold text-xs uppercase tracking-[0.15em] px-6 py-3 rounded-md border border-border text-foreground hover:bg-secondary transition-colors"
              >
                Return Home
              </Link>
            </div>
          </div>
        ) : booking ? (
          <div className="space-y-6">
            <div className="text-4xl mb-2">🎉</div>
            <h1 className="font-display text-xl font-bold chrome-text">Booking Confirmed!</h1>
            <div className="bg-secondary rounded-md p-4 text-left border border-border space-y-2">
              <p className="text-foreground font-display font-semibold">{booking.room_title}</p>
              <p className="text-muted-foreground text-xs font-body">
                📅 {booking.booking_date} · {booking.booking_time}
              </p>
              <p className="text-muted-foreground text-xs font-body">
                👤 {booking.customer_name}
              </p>
              <div className="border-t border-border pt-2 mt-2">
                <p className="text-chrome font-display font-bold text-sm">
                  ${(booking.amount_cents / 100).toFixed(2)} paid
                </p>
              </div>
            </div>
            <p className="text-muted-foreground text-xs font-body">
              A confirmation has been sent to your email.
            </p>

            {/* Add to Calendar — downloads an .ics that any calendar app
                (Apple, Google, Outlook) imports. Includes a 1-hour-before
                reminder + pickup location. */}
            <Button
              type="button"
              onClick={() => {
                const ics = buildBookingIcs({
                  id: booking.id,
                  room_title: booking.room_title,
                  booking_date: booking.booking_date,
                  booking_time: booking.booking_time,
                });
                const blob = new Blob([ics], {
                  type: "text/calendar;charset=utf-8",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `replay-club-${booking.booking_date}.ics`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                toast.success("Saved — open the .ics file to add to your calendar");
              }}
              variant="outline"
              className="w-full border-border font-display text-xs uppercase tracking-widest"
            >
              <CalendarPlus className="h-4 w-4 mr-2" />
              Add to Calendar
            </Button>

            {/* Check-in QR code */}
            {booking.id && (
              <div className="bg-secondary/50 rounded-md p-4 border border-border space-y-3">
                <div className="flex items-center gap-2 justify-center">
                  <QrCode className="h-4 w-4 text-chrome" />
                  <span className="text-xs font-display uppercase tracking-widest text-muted-foreground">
                    Check-in QR
                  </span>
                </div>
                <div className="bg-white rounded-md p-3 mx-auto w-fit">
                  <QRCodeSVG
                    value={`replayclub:checkin:${booking.id}`}
                    size={180}
                    level="M"
                    includeMargin={false}
                  />
                </div>
                <p className="text-muted-foreground text-[11px] font-body">
                  Show this QR at the door — staff will scan you in.
                </p>
              </div>
            )}

            {/* Collaborative Session Invite */}
            {sessionLink ? (
              <div className="bg-secondary/50 rounded-md p-4 border border-border space-y-3">
                <div className="flex items-center gap-2 justify-center">
                  <Users className="h-4 w-4 text-chrome" />
                  <span className="text-xs font-display uppercase tracking-widest text-muted-foreground">Invite Your Crew</span>
                </div>
                <p className="text-muted-foreground text-xs font-body">
                  Share this link so guests can join your lineup and leave messages
                </p>
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(sessionLink);
                    setLinkCopied(true);
                    toast.success("Session link copied!");
                    setTimeout(() => setLinkCopied(false), 2000);
                  }}
                  variant="outline"
                  className="w-full border-border font-display text-xs uppercase tracking-widest"
                >
                  {linkCopied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                  {linkCopied ? "Copied!" : "Copy Session Link"}
                </Button>
                <Link
                  to={sessionLink.replace(window.location.origin, "")}
                  className="text-chrome text-xs font-body underline hover:no-underline block"
                >
                  View session page →
                </Link>
              </div>
            ) : (
              <p className="text-muted-foreground text-[10px] font-body">Creating your session invite...</p>
            )}

            <SocialShareCard
              roomTitle={booking.room_title}
              bookingDate={booking.booking_date}
              bookingTime={booking.booking_time}
              customerName={booking.customer_name}
            />
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Link
                to="/profile?tab=bookings"
                className="inline-block chrome-btn font-display font-semibold text-xs uppercase tracking-[0.15em] px-6 py-3 rounded-md"
              >
                View My Bookings
              </Link>
              <Link
                to="/"
                className="inline-block font-display font-semibold text-xs uppercase tracking-[0.15em] px-6 py-3 rounded-md border border-border text-foreground hover:bg-secondary transition-colors"
              >
                Book Another
              </Link>
            </div>
          </div>
        ) : null}
      </motion.div>
    </div>
  );
};

export default BookingSuccess;
