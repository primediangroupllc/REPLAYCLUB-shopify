import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ShieldCheck, X, CheckCircle2, AlertCircle, AlertTriangle, Calendar, Clock, MapPin, User, Mail, Phone, DollarSign, Users, QrCode, CameraOff } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { logAdminAction } from "@/lib/auditLog";

interface Booking {
  id: string;
  room_title: string;
  booking_date: string;
  booking_time: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  payment_status: string;
  amount_cents: number;
  tier: string | null;
  equipment: unknown;
  lighting: string | null;
  backdrop: string | null;
  custom_requests: string | null;
  id_photo_url: string | null;
  id_verified: string | null;
  checked_in_at: string | null;
  checked_in_by: string | null;
}

interface GuestRow {
  id: string;
  guest_name: string;
  id_verified: string;
}

interface AdminCheckInProps {
  initialBookingId?: string | null;
  onInitialBookingConsumed?: () => void;
}

const AdminCheckIn = ({ initialBookingId, onInitialBookingConsumed }: AdminCheckInProps = {}) => {
  const [code, setCode] = useState("");
  const [matches, setMatches] = useState<Booking[]>([]);
  const [searching, setSearching] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [idUrl, setIdUrl] = useState<string | null>(null);
  const [idMatched, setIdMatched] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [guestsLoading, setGuestsLoading] = useState(false);
  const [adminOverride, setAdminOverride] = useState(false);
  const { toast } = useToast();

  // QR scanner state — scanner is the DEFAULT view; manual entry is opt-in
  const [scannerOpen, setScannerOpen] = useState(true);
  const [scannerStarting, setScannerStarting] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<{ code: string; ts: number }>({ code: "", ts: 0 });
  const SCANNER_REGION_ID = "admin-checkin-qr-region";
  const UUID_RE_GLOBAL = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

  // Load signed URL for ID photo
  useEffect(() => {
    if (booking?.id_photo_url) {
      supabase.storage
        .from("id-verification")
        .createSignedUrl(booking.id_photo_url, 600)
        .then(({ data }) => setIdUrl(data?.signedUrl || null));
    } else {
      setIdUrl(null);
    }
  }, [booking?.id_photo_url]);

  // Load invited guests for this booking and their ID verification status
  useEffect(() => {
    if (!booking?.id) {
      setGuests([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setGuestsLoading(true);
      const { data: invites } = await supabase
        .from("session_invites")
        .select("id")
        .eq("booking_id", booking.id);
      const inviteIds = (invites ?? []).map((i: { id: string }) => i.id);
      if (inviteIds.length === 0) {
        if (!cancelled) {
          setGuests([]);
          setGuestsLoading(false);
        }
        return;
      }
      const { data: g } = await supabase
        .from("session_guests")
        .select("id, guest_name, id_verified")
        .in("session_invite_id", inviteIds);
      if (!cancelled) {
        setGuests((g as GuestRow[]) ?? []);
        setGuestsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [booking?.id]);

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBooking(null);
    setMatches([]);
    setIdMatched(false);
    const trimmed = code.trim();
    if (trimmed.length < 2) {
      setError("Enter a name, email, or booking ID.");
      return;
    }
    setSearching(true);
    try {
      // Direct UUID lookup
      if (UUID_RE.test(trimmed)) {
        const { data, error: fetchErr } = await supabase
          .from("bookings")
          .select("*")
          .eq("id", trimmed.toLowerCase())
          .maybeSingle();
        if (fetchErr) { setError(fetchErr.message); return; }
        if (!data) { setError("No booking with that ID."); return; }
        setBooking(data as unknown as Booking);
        return;
      }
      // Name / email fuzzy search — limit to today + future paid/promo bookings
      const today = new Date().toISOString().slice(0, 10);
      const q = trimmed.toLowerCase();
      const { data, error: fetchErr } = await supabase
        .from("bookings")
        .select("*")
        .in("payment_status", ["paid", "promo"])
        .gte("booking_date", today)
        .or(`customer_name.ilike.%${q}%,customer_email.ilike.%${q}%`)
        .order("booking_date", { ascending: true })
        .limit(10);
      if (fetchErr) { setError(fetchErr.message); return; }
      const list = (data ?? []) as unknown as Booking[];
      if (list.length === 0) {
        setError("No upcoming paid bookings match.");
      } else if (list.length === 1) {
        setBooking(list[0]);
      } else {
        setMatches(list);
      }
    } finally {
      setSearching(false);
    }
  };

  const handleConfirm = async () => {
    if (!booking || !idMatched) return;
    if (hasGuestBlock && !adminOverride) {
      toast({
        title: "Check-in blocked",
        description: "All invited guests must have approved IDs (or use admin override).",
        variant: "destructive",
      });
      return;
    }
    setConfirming(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { error: updErr } = await supabase
      .from("bookings")
      .update({
        checked_in_at: new Date().toISOString(),
        checked_in_by: session?.user.id || null,
      })
      .eq("id", booking.id);
    if (updErr) {
      setConfirming(false);
      toast({ title: "Check-in failed", description: updErr.message, variant: "destructive" });
      return;
    }
    // ID verification goes through the audited, admin-gated RPC (Audit #1).
    const { error: verifyErr } = await (supabase as any).rpc("admin_set_booking_id_verification", {
      p_booking_id: booking.id,
      p_decision: "approved",
    });
    setConfirming(false);
    if (verifyErr) {
      toast({ title: "ID verification failed", description: verifyErr.message, variant: "destructive" });
      return;
    }
    await logAdminAction("verify", "booking", booking.id, {
      booking_id: booking.id,
      customer_name: booking.customer_name,
      action_type: "check_in",
    });
    setVerified(true);
  };

  const reset = () => {
    setVerified(false);
    setBooking(null);
    setMatches([]);
    setCode("");
    setIdMatched(false);
    setIdUrl(null);
    setError(null);
    setGuests([]);
    setAdminOverride(false);
  };

  // ---------- QR scanner ----------
  const stopScanner = async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    if (s) {
      try { await s.stop(); } catch { /* ignore */ }
      try { await s.clear(); } catch { /* ignore */ }
    }
  };

  const lookupBookingByUuid = async (uuid: string) => {
    setError(null);
    setMatches([]);
    setIdMatched(false);
    const id = uuid.toLowerCase();
    const { data, error: fetchErr } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (fetchErr) {
      setError(fetchErr.message);
      toast({ title: "Lookup failed", description: fetchErr.message, variant: "destructive" });
      return;
    }
    if (!data) {
      setError(`No booking found for ${id.slice(0, 8)}…`);
      toast({ title: "Invalid QR", description: "No booking matches that code.", variant: "destructive" });
      navigator.vibrate?.(200);
      return;
    }
    setBooking(data as unknown as Booking);
    setCode(id);
    toast({ title: "Booking loaded", description: (data as unknown as Booking).customer_name });
    navigator.vibrate?.([50, 50, 50]);
  };

  const handleScanned = async (raw: string) => {
    const trimmed = raw.trim();
    // Debounce duplicate scans within 3s
    const now = Date.now();
    if (lastScanRef.current.code === trimmed && now - lastScanRef.current.ts < 3000) return;
    lastScanRef.current = { code: trimmed, ts: now };

    // Accept "replayclub:checkin:<uuid>" or any embedded UUID
    let uuid: string | null = null;
    const tagged = trimmed.match(/^replayclub:checkin:(.+)$/i);
    if (tagged) {
      const m = tagged[1].match(UUID_RE_GLOBAL);
      if (m) uuid = m[0];
    } else {
      const m = trimmed.match(UUID_RE_GLOBAL);
      if (m) uuid = m[0];
    }

    if (!uuid) {
      setScannerError("Unrecognized QR code — expected a Replay Club check-in code.");
      navigator.vibrate?.(200);
      return;
    }

    // Stop the scanner before navigating UI state
    await stopScanner();
    setScannerOpen(false);
    setScannerError(null);
    await lookupBookingByUuid(uuid);
  };

  const startScanner = async () => {
    setScannerError(null);
    setScannerStarting(true);
    try {
      // Poll for the region div — it may not be in the DOM yet on first render
      let region: HTMLElement | null = null;
      for (let i = 0; i < 20; i++) {
        region = document.getElementById(SCANNER_REGION_ID);
        if (region && region.clientWidth > 0) break;
        await new Promise<void>((r) => setTimeout(r, 50));
      }
      if (!region) throw new Error("Scanner region not ready");

      // Tear down any leftover instance from a previous mount
      if (scannerRef.current) {
        try { await scannerRef.current.stop(); } catch { /* ignore */ }
        try { await scannerRef.current.clear(); } catch { /* ignore */ }
        scannerRef.current = null;
      }
      // Clean any stale child nodes from a previous html5-qrcode mount
      region.innerHTML = "";

      const scanner = new Html5Qrcode(SCANNER_REGION_ID, /* verbose */ false);
      scannerRef.current = scanner;

      const config = { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1.0 };
      const onDecode = (decoded: string) => { void handleScanned(decoded); };
      const onErr = () => { /* ignore per-frame decode errors */ };

      // Try environment-facing first; if that throws (some desktops, some iOS/Safari combos),
      // fall back to enumerated cameras and prefer the back camera by label, else use any.
      try {
        await scanner.start({ facingMode: { exact: "environment" } }, config, onDecode, onErr);
      } catch {
        try {
          await scanner.start({ facingMode: "environment" }, config, onDecode, onErr);
        } catch {
          const cameras = await Html5Qrcode.getCameras().catch(() => [] as Array<{ id: string; label: string }>);
          if (!cameras || cameras.length === 0) {
            throw new Error("No cameras found. Check browser permissions.");
          }
          const back = cameras.find((c) => /back|rear|environment/i.test(c.label)) ?? cameras[cameras.length - 1];
          await scanner.start({ deviceId: { exact: back.id } }, config, onDecode, onErr);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Camera unavailable";
      setScannerError(msg);
      toast({ title: "Camera error", description: msg, variant: "destructive" });
      scannerRef.current = null;
    } finally {
      setScannerStarting(false);
    }
  };

  // Open / close scanner lifecycle
  useEffect(() => {
    // Only run the camera when no booking is loaded (the scanner UI is unmounted otherwise)
    if (scannerOpen && !booking) {
      void startScanner();
    } else {
      void stopScanner();
    }
    return () => { void stopScanner(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannerOpen, booking]);

  // Cleanup on unmount
  useEffect(() => () => { void stopScanner(); }, []);

  // Auto-load a booking passed in via prop (e.g. from the Today's Bookings widget)
  useEffect(() => {
    if (!initialBookingId) return;
    setScannerOpen(false);
    void lookupBookingByUuid(initialBookingId);
    onInitialBookingConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBookingId]);

  const equipmentList = Array.isArray(booking?.equipment) ? (booking?.equipment as string[]) : [];

  const blockingGuests = guests.filter((g) => g.id_verified !== "approved");
  const hasGuestBlock = blockingGuests.length > 0;
  const canConfirm = idMatched && (!hasGuestBlock || adminOverride);

  return (
    <div className="space-y-4">
      {/* Force the html5-qrcode injected <video> to fill the region */}
      <style>{`
        #${SCANNER_REGION_ID} { position: relative; }
        #${SCANNER_REGION_ID} video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          display: block !important;
        }
      `}</style>

      {/* PRIMARY: QR scanner (only when no booking is loaded) */}
      {!booking && (
        <div className="chrome-surface rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-primary" />
              <span className="text-[10px] font-display uppercase tracking-wider text-muted-foreground">
                {scannerStarting ? "Starting camera…" : scannerOpen ? "Scanning" : "Camera off"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setScannerOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-[10px] font-display uppercase tracking-wider text-foreground hover:bg-muted/40 transition-colors"
            >
              {scannerOpen ? <CameraOff className="w-3.5 h-3.5" /> : <QrCode className="w-3.5 h-3.5" />}
              {scannerOpen ? "Stop" : "Start"}
            </button>
          </div>

          <div className="relative w-full bg-black rounded-md overflow-hidden aspect-square max-h-[420px]">
            <div id={SCANNER_REGION_ID} className="absolute inset-0 w-full h-full" />
            {!scannerOpen && (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs font-body">
                Tap "Start" to enable camera
              </div>
            )}
            {scannerOpen && scannerStarting && (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs font-body bg-black/40">
                Starting camera…
              </div>
            )}
          </div>

          {scannerError && (
            <div className="flex items-center gap-2 text-xs text-destructive font-body">
              <AlertCircle className="w-3.5 h-3.5" />
              {scannerError}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground font-body text-center">
            Point the camera at the check-in QR from the booking confirmation email.
          </p>

          {/* Fallback: manual entry */}
          <div className="pt-3 border-t border-border/30">
            {!manualOpen ? (
              <button
                type="button"
                onClick={() => setManualOpen(true)}
                className="w-full text-center text-[11px] font-display uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                Enter code or search by name instead →
              </button>
            ) : (
              <form onSubmit={handleSearch} className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-display uppercase tracking-wider text-muted-foreground">
                    Name, email, or booking ID
                  </label>
                  <button
                    type="button"
                    onClick={() => { setManualOpen(false); setError(null); }}
                    className="text-[10px] font-display uppercase tracking-wider text-muted-foreground hover:text-foreground"
                  >
                    Hide
                  </button>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Jordan or jordan@email.com"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full min-w-0 flex-1 bg-card border border-border rounded-md px-3 py-3 text-base font-body text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    autoComplete="off"
                  />
                  <button
                    type="submit"
                    disabled={searching || code.trim().length < 2}
                    className="w-full sm:w-auto px-6 py-3 rounded-md bg-primary text-primary-foreground font-display text-xs uppercase tracking-wider font-semibold disabled:opacity-40 hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Search className="w-3.5 h-3.5" />
                    {searching ? "..." : "Find"}
                  </button>
                </div>
                {error && (
                  <div className="flex items-center gap-2 text-xs text-destructive font-body">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {error}
                  </div>
                )}
              </form>
            )}
          </div>
        </div>
      )}

      {/* Multiple matches list */}
      {matches.length > 0 && !booking && (
        <div className="chrome-surface rounded-lg p-3 space-y-2">
          <p className="text-[10px] font-display uppercase tracking-wider text-muted-foreground px-1">
            {matches.length} matches — pick one
          </p>
          {matches.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => { setBooking(m); setMatches([]); }}
              className="w-full text-left px-3 py-2 rounded-md bg-card border border-border hover:border-primary/50 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-display font-semibold text-foreground truncate">{m.customer_name}</p>
                  <p className="text-[11px] text-muted-foreground font-body truncate">{m.customer_email}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-foreground font-body">{m.room_title}</p>
                  <p className="text-[10px] text-muted-foreground font-body">{m.booking_date} · {m.booking_time}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Booking found — verification panel */}
      {booking && !verified && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="chrome-surface rounded-lg overflow-hidden"
        >
          {/* Status header */}
          <div className={`px-4 py-2 flex items-center justify-between ${
            booking.checked_in_at ? "bg-primary/20" : "bg-yellow-500/10"
          }`}>
            <span className="text-[10px] font-display uppercase tracking-wider text-foreground">
              {booking.checked_in_at ? "Already Checked In" : "Pending Check-In"}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {booking.id.slice(0, 8)}
            </span>
          </div>

          <div className="p-4 grid md:grid-cols-2 gap-4">
            {/* ID Photo */}
            <div className="space-y-2">
              <p className="text-[10px] font-display uppercase tracking-wider text-muted-foreground">
                Government ID on File
              </p>
              {idUrl ? (
                <img src={idUrl} alt="Government ID" className="w-full rounded-md border-2 border-border" />
              ) : booking.id_photo_url ? (
                <div className="aspect-video bg-muted animate-pulse rounded-md" />
              ) : (
                <div className="aspect-video bg-muted/30 rounded-md flex items-center justify-center text-muted-foreground text-xs font-body border border-border">
                  No ID uploaded
                </div>
              )}
            </div>

            {/* Booking details */}
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-display uppercase tracking-wider text-muted-foreground">Customer</p>
                <p className="font-display text-lg font-bold text-foreground">{booking.customer_name}</p>
              </div>
              <div className="grid grid-cols-1 gap-1.5 text-xs font-body">
                <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="w-3 h-3" /><span className="text-foreground">{booking.room_title}</span></div>
                <div className="flex items-center gap-2 text-muted-foreground"><Calendar className="w-3 h-3" /><span className="text-foreground">{booking.booking_date}</span></div>
                <div className="flex items-center gap-2 text-muted-foreground"><Clock className="w-3 h-3" /><span className="text-foreground">{booking.booking_time}</span></div>
                <div className="flex items-center gap-2 text-muted-foreground"><Mail className="w-3 h-3" /><span className="text-foreground truncate">{booking.customer_email}</span></div>
                <div className="flex items-center gap-2 text-muted-foreground"><Phone className="w-3 h-3" /><span className="text-foreground">{booking.customer_phone}</span></div>
                <div className="flex items-center gap-2 text-muted-foreground"><DollarSign className="w-3 h-3" /><span className="text-foreground">${(booking.amount_cents / 100).toFixed(2)} • {booking.payment_status}</span></div>
                {booking.tier && (
                  <div className="flex items-center gap-2 text-muted-foreground"><User className="w-3 h-3" /><span className="text-foreground">{booking.tier}</span></div>
                )}
                {equipmentList.length > 0 && (
                  <div className="text-muted-foreground mt-1">
                    <p className="text-[10px] uppercase tracking-wider mb-0.5">Equipment</p>
                    <p className="text-foreground">{equipmentList.join(", ")}</p>
                  </div>
                )}
                {booking.backdrop && (
                  <div className="text-muted-foreground mt-1">
                    <p className="text-[10px] uppercase tracking-wider mb-0.5">Backdrop</p>
                    <p className="text-foreground">{booking.backdrop}</p>
                  </div>
                )}
                {booking.lighting && (
                  <div className="text-muted-foreground mt-1">
                    <p className="text-[10px] uppercase tracking-wider mb-0.5">Lighting</p>
                    <p className="text-foreground">{booking.lighting}</p>
                  </div>
                )}
                {booking.custom_requests && (
                  <div className="text-muted-foreground mt-1">
                    <p className="text-[10px] uppercase tracking-wider mb-0.5">Special Requests</p>
                    <p className="text-foreground whitespace-pre-wrap">{booking.custom_requests}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Guest ID status */}
          {(guestsLoading || guests.length > 0) && (
            <div className="border-t border-border/30 p-4 space-y-2">
              <p className="text-[10px] font-display uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Users className="w-3 h-3" /> Invited Guests ({guests.length})
              </p>
              {guestsLoading ? (
                <p className="text-xs text-muted-foreground font-body">Loading guests...</p>
              ) : (
                <ul className="space-y-1">
                  {guests.map((g) => {
                    const status = g.id_verified;
                    const color =
                      status === "approved"
                        ? "text-primary"
                        : status === "rejected"
                        ? "text-destructive"
                        : "text-yellow-500";
                    return (
                      <li
                        key={g.id}
                        className="flex items-center justify-between text-xs font-body"
                      >
                        <span className="text-foreground truncate">{g.guest_name}</span>
                        <span className={`uppercase tracking-wider text-[10px] font-display ${color}`}>
                          {status}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {hasGuestBlock && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 space-y-2">
                  <div className="flex items-start gap-2 text-destructive">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="text-xs font-body leading-snug">
                      <p className="font-semibold">
                        {blockingGuests.length} guest
                        {blockingGuests.length === 1 ? "" : "s"} have unverified IDs.
                      </p>
                      <p className="text-foreground/80 mt-0.5">
                        Check-in is blocked until every guest's ID is approved.
                        Approve them in the Bookings tab, or override below if you've
                        verified them in person.
                      </p>
                    </div>
                  </div>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={adminOverride}
                      onChange={(e) => setAdminOverride(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-border bg-card accent-primary"
                    />
                    <span className="text-[11px] font-body text-foreground/90">
                      Admin override — I have visually verified all guest IDs at the door.
                    </span>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Confirmation actions */}
          <div className="border-t border-border/30 p-4 space-y-3">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={idMatched}
                onChange={(e) => setIdMatched(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-border bg-card accent-primary"
              />
              <span className="text-xs font-body text-foreground">
                I have visually verified that the ID photo matches the person at the door.
              </span>
            </label>
            <div className="flex gap-2">
              <button
                onClick={reset}
                className="flex-1 py-2 rounded-md border border-border text-muted-foreground hover:text-foreground text-xs font-display uppercase tracking-wider transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={!canConfirm || confirming}
                className="flex-[2] py-2 rounded-md bg-primary text-primary-foreground font-display text-xs uppercase tracking-wider font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40 hover:bg-primary/90 transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                {confirming ? "Verifying..." : "Confirm Check-In"}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* VERIFIED full-screen overlay */}
      <AnimatePresence>
        {verified && booking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="max-w-2xl w-full chrome-surface rounded-2xl overflow-hidden border-2 border-primary/40 my-auto"
              style={{ boxShadow: "0 0 80px hsl(var(--primary) / 0.3)" }}
            >
              {/* Big check */}
              <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-8 text-center relative">
                <button
                  onClick={reset}
                  className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", duration: 0.7, delay: 0.1 }}
                  className="inline-flex"
                >
                  <CheckCircle2 className="w-24 h-24 text-primary" strokeWidth={1.5} />
                </motion.div>
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="font-display text-3xl font-bold chrome-text mt-4 tracking-wider uppercase"
                >
                  Verified
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="text-muted-foreground font-body text-sm mt-2"
                >
                  Welcome to Replay Club, {booking.customer_name.split(" ")[0]}.
                </motion.p>
              </div>

              {/* Details */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="grid md:grid-cols-2 gap-4 p-6"
              >
                {idUrl && (
                  <img src={idUrl} alt="ID" className="w-full rounded-lg border border-border" />
                )}
                <div className="space-y-2 text-xs font-body">
                  <div className="space-y-1">
                    <p className="text-foreground"><strong>{booking.room_title}</strong></p>
                    <p className="text-muted-foreground">{booking.booking_date} • {booking.booking_time}</p>
                    {booking.tier && <p className="text-muted-foreground">{booking.tier}</p>}
                    {equipmentList.length > 0 && (
                      <p className="text-muted-foreground text-[11px]">{equipmentList.join(", ")}</p>
                    )}
                  </div>
                  <div className="pt-2 border-t border-border/30 text-muted-foreground">
                    <p>{booking.customer_email}</p>
                    <p>{booking.customer_phone}</p>
                  </div>
                </div>
              </motion.div>

              <div className="p-4 border-t border-border/30">
                <button
                  onClick={reset}
                  className="w-full py-2.5 rounded-md bg-primary text-primary-foreground font-display text-xs uppercase tracking-wider font-semibold hover:bg-primary/90 transition-colors"
                >
                  Next Check-In
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminCheckIn;
