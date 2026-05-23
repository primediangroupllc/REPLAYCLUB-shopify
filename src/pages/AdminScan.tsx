import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Camera, CheckCircle2, XCircle, ArrowLeft, RotateCcw, Search } from "lucide-react";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { useAdminSessionTimeout } from "@/hooks/useAdminSessionTimeout";

interface ScanResult {
  status: "success" | "already" | "invalid" | "error";
  message: string;
  attendee?: {
    name: string;
    email: string;
    eventTitle: string;
    ticketCode: string;
    checkedInAt?: string;
  };
  kind?: "event" | "booking";
}

const SCANNER_ID = "qr-scanner-region";

const AdminScan = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  useAdminSessionTimeout(authorized === true);
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [processing, setProcessing] = useState(false);
  const [staffNote, setStaffNote] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastCodeRef = useRef<string>("");
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const isAdmin = roles?.some((r) => r.role === "admin");
      setAuthorized(!!isAdmin);
    })();
  }, [navigate]);

  useEffect(() => {
    return () => {
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

  const extractCode = (raw: string): { code: string; kind: "event" | "booking" | "unknown" } => {
    const trimmed = raw.trim();
    // Booking QR encodes "replayclub:checkin:<uuid>"
    const tagged = trimmed.match(/^replayclub:checkin:(.+)$/i);
    if (tagged && UUID_RE.test(tagged[1])) {
      return { code: tagged[1].toLowerCase(), kind: "booking" };
    }
    // Bare UUID
    const uuidMatch = trimmed.match(UUID_RE);
    if (uuidMatch && trimmed.length <= 50) {
      return { code: uuidMatch[0].toLowerCase(), kind: "booking" };
    }
    // Otherwise treat as event ticket code
    return { code: trimmed.toUpperCase(), kind: trimmed ? "event" : "unknown" };
  };

  const handleCode = async (rawCode: string) => {
    const { code, kind } = extractCode(rawCode);
    if (!code) return;
    // Debounce duplicate scans (same code within 3s)
    const now = Date.now();
    if (lastCodeRef.current === code && now - lastTimeRef.current < 3000) return;
    lastCodeRef.current = code;
    lastTimeRef.current = now;
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Booking check-in path
      if (kind === "booking") {
        const { data: booking, error } = await supabase
          .from("bookings")
          .select("id, customer_name, customer_email, room_title, booking_date, booking_time, checked_in_at, payment_status")
          .eq("id", code)
          .maybeSingle();

        if (error || !booking) {
          // Try equipment rental as a fallback (same UUID format)
          const { data: rental } = await supabase
            .from("equipment_rentals")
            .select("id, customer_name, customer_email, items, pickup_date, rental_days, checked_in_at, payment_status")
            .eq("id", code)
            .maybeSingle();

          if (!rental) {
            setLastResult({ status: "invalid", message: `Booking ${code.slice(0, 8)} not found.`, kind: "booking" });
            navigator.vibrate?.(200);
            return;
          }

          if (rental.payment_status !== "paid") {
            setLastResult({
              status: "invalid",
              message: `Rental is "${rental.payment_status}" — not eligible for pickup.`,
              kind: "booking",
            });
            navigator.vibrate?.(200);
            return;
          }

          if (rental.checked_in_at) {
            setLastResult({
              status: "already",
              message: "Rental already picked up.",
              kind: "booking",
              attendee: {
                name: rental.customer_name,
                email: rental.customer_email,
                eventTitle: `Equipment rental · pickup ${rental.pickup_date ?? "—"}`,
                ticketCode: code.slice(0, 8),
                checkedInAt: rental.checked_in_at,
              },
            });
            navigator.vibrate?.(100);
            return;
          }

          const { error: rentalUpdateErr } = await supabase
            .from("equipment_rentals")
            .update({
              checked_in_at: new Date().toISOString(),
              checked_in_by: user?.id ?? null,
              staff_check_in_note: staffNote.trim() || null,
            })
            .eq("id", rental.id);

          if (rentalUpdateErr) {
            setLastResult({ status: "error", message: rentalUpdateErr.message, kind: "booking" });
            return;
          }

          const itemsList = Array.isArray(rental.items) ? (rental.items as string[]).join(", ") : "—";
          setLastResult({
            status: "success",
            message: "Rental checked out!",
            kind: "booking",
            attendee: {
              name: rental.customer_name,
              email: rental.customer_email,
              eventTitle: `Rental · ${itemsList}`,
              ticketCode: code.slice(0, 8),
            },
          });
          navigator.vibrate?.([50, 50, 50]);
          setStaffNote("");
          return;
        }

        if (booking.payment_status !== "paid" && booking.payment_status !== "promo") {
          setLastResult({
            status: "invalid",
            message: `Booking is "${booking.payment_status}" — not eligible for check-in.`,
            kind: "booking",
          });
          navigator.vibrate?.(200);
          return;
        }

        if (booking.checked_in_at) {
          setLastResult({
            status: "already",
            message: "Already checked in.",
            kind: "booking",
            attendee: {
              name: booking.customer_name,
              email: booking.customer_email,
              eventTitle: `${booking.room_title} · ${booking.booking_date} ${booking.booking_time}`,
              ticketCode: code.slice(0, 8),
              checkedInAt: booking.checked_in_at,
            },
          });
          navigator.vibrate?.(100);
          return;
        }

        const { error: updateError } = await supabase
          .from("bookings")
          .update({
            checked_in_at: new Date().toISOString(),
            checked_in_by: user?.id ?? null,
            staff_check_in_note: staffNote.trim() || null,
          })
          .eq("id", booking.id);

        if (updateError) {
          setLastResult({ status: "error", message: updateError.message, kind: "booking" });
          return;
        }

        setLastResult({
          status: "success",
          message: "Checked in!",
          kind: "booking",
          attendee: {
            name: booking.customer_name,
            email: booking.customer_email,
            eventTitle: `${booking.room_title} · ${booking.booking_date} ${booking.booking_time}`,
            ticketCode: code.slice(0, 8),
          },
        });
        navigator.vibrate?.([50, 50, 50]);
        setStaffNote("");
        return;
      }

      // Event ticket path (existing behavior)
      const { data: rsvp, error } = await supabase
        .from("event_rsvps")
        .select("id, user_name, user_email, ticket_code, checked_in_at, status, events(title)")
        .eq("ticket_code", code)
        .maybeSingle();

      if (error || !rsvp) {
        setLastResult({ status: "invalid", message: `Ticket "${code}" not found.` });
        navigator.vibrate?.(200);
        return;
      }

      const eventTitle = (rsvp.events as { title: string } | null)?.title || "Event";

      if (rsvp.checked_in_at) {
        setLastResult({
          status: "already",
          message: "Already checked in.",
          attendee: {
            name: rsvp.user_name,
            email: rsvp.user_email,
            eventTitle,
            ticketCode: code,
            checkedInAt: rsvp.checked_in_at,
          },
        });
        navigator.vibrate?.(100);
        return;
      }

      if (rsvp.status !== "confirmed") {
        setLastResult({
          status: "invalid",
          message: `Ticket status is "${rsvp.status}" — not eligible for entry.`,
        });
        navigator.vibrate?.(200);
        return;
      }

      const { error: updateError } = await supabase
        .from("event_rsvps")
        .update({
          checked_in_at: new Date().toISOString(),
          checked_in_by: user?.id ?? null,
        })
        .eq("id", rsvp.id);

      if (updateError) {
        setLastResult({ status: "error", message: updateError.message });
        return;
      }

      setLastResult({
        status: "success",
        message: "Checked in!",
        attendee: {
          name: rsvp.user_name,
          email: rsvp.user_email,
          eventTitle,
          ticketCode: code,
        },
      });
      navigator.vibrate?.([50, 50, 50]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setLastResult({ status: "error", message: msg });
    } finally {
      setProcessing(false);
    }
  };

  const startScanner = async () => {
    if (scannerRef.current) return;
    try {
      const scanner = new Html5Qrcode(SCANNER_ID);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        (decodedText) => {
          handleCode(decodedText);
        },
        () => {},
      );
      setScanning(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Camera unavailable";
      toast({
        title: "Camera error",
        description: msg,
        variant: "destructive",
      });
      scannerRef.current = null;
    }
  };

  const stopScanner = async () => {
    if (!scannerRef.current) return;
    try {
      await scannerRef.current.stop();
      await scannerRef.current.clear();
    } catch {
      // ignore
    }
    scannerRef.current = null;
    setScanning(false);
  };

  const submitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    await handleCode(manualCode);
    setManualCode("");
  };

  if (authorized === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="p-8 text-center max-w-md">
          <h1 className="text-xl font-bold mb-2">Admins only</h1>
          <p className="text-sm text-muted-foreground mb-6">
            You need an admin role to access the door scanner.
          </p>
          <Button onClick={() => navigate("/")}>Back home</Button>
        </Card>
      </div>
    );
  }

  return (
    <AdminPageShell>
    <div className="bg-background pb-12">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="w-20" />
          <h1 className="text-lg font-bold tracking-tight">Door Scanner</h1>
          <div className="w-20" />
        </div>

        <Card className="overflow-hidden">
          <div className="bg-muted/50 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4" />
              <span className="text-sm font-medium">
                {scanning ? "Scanning…" : "Camera off"}
              </span>
            </div>
            {scanning ? (
              <Button size="sm" variant="outline" onClick={stopScanner}>
                Stop
              </Button>
            ) : (
              <Button size="sm" onClick={startScanner}>
                Start camera
              </Button>
            )}
          </div>
          <div
            id={SCANNER_ID}
            className="w-full bg-black aspect-square max-h-[420px] flex items-center justify-center text-muted-foreground text-xs"
          >
            {!scanning && "Tap “Start camera” to scan tickets"}
          </div>
        </Card>

        <Card className="p-4">
          <div className="space-y-3">
            <Input
              value={staffNote}
              onChange={(e) => setStaffNote(e.target.value)}
              placeholder="Optional staff note (booking check-ins only)"
              maxLength={200}
            />
            <form onSubmit={submitManual} className="flex gap-2">
              <Input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                placeholder="Ticket code or 7-digit confirmation #"
                className="font-mono tracking-widest uppercase"
                autoCapitalize="characters"
                autoCorrect="off"
              />
              <Button type="submit" disabled={processing || !manualCode.trim()}>
                <Search className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </Card>

        {lastResult && (
          <Card
            className={`p-5 border-2 ${
              lastResult.status === "success"
                ? "border-green-500/50 bg-green-500/5"
                : lastResult.status === "already"
                  ? "border-yellow-500/50 bg-yellow-500/5"
                  : "border-destructive/50 bg-destructive/5"
            }`}
          >
            <div className="flex items-start gap-3">
              {lastResult.status === "success" ? (
                <CheckCircle2 className="w-8 h-8 text-green-500 shrink-0" />
              ) : lastResult.status === "already" ? (
                <CheckCircle2 className="w-8 h-8 text-yellow-500 shrink-0" />
              ) : (
                <XCircle className="w-8 h-8 text-destructive shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-lg leading-tight">{lastResult.message}</p>
                {lastResult.attendee && (
                  <div className="mt-2 space-y-1 text-sm">
                    <p className="font-semibold">{lastResult.attendee.name}</p>
                    <p className="text-muted-foreground">{lastResult.attendee.email}</p>
                    <p className="text-muted-foreground">
                      <span className="opacity-60">Event:</span> {lastResult.attendee.eventTitle}
                    </p>
                    <p className="font-mono text-xs tracking-widest">
                      {lastResult.attendee.ticketCode}
                    </p>
                    {lastResult.attendee.checkedInAt && (
                      <p className="text-xs text-muted-foreground">
                        Originally at{" "}
                        {new Date(lastResult.attendee.checkedInAt).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setLastResult(null);
                  lastCodeRef.current = "";
                }}
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Camera requires HTTPS and permission. Codes are matched against confirmed RSVPs only.
        </p>
      </div>
    </div>
    </AdminPageShell>
  );
};

export default AdminScan;
