import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Gift, CheckCircle, AlertCircle, CalendarIcon, Clock, Palette, FileSignature } from "lucide-react";
import SignaturePad from "@/components/SignaturePad";
import StudioRepSignature from "@/components/StudioRepSignature";
import { dataUrlToBlob } from "@/lib/utils";
import type HCaptcha from "@hcaptcha/react-hcaptcha";
import HCaptchaWidget from "@/components/HCaptchaWidget";

const LAYOUT_OPTIONS = [
  { id: "classic", label: "Classic Studio", desc: "Traditional recording layout" },
  { id: "lounge", label: "Lounge Vibes", desc: "Relaxed couch & rug setup" },
  { id: "performance", label: "Performance", desc: "Open space for live sets" },
  { id: "interview", label: "Interview Set", desc: "Face-to-face seated arrangement" },
];

const LIGHTING_OPTIONS = [
  { id: "ambient", label: "Ambient Warm", desc: "Soft warm tones" },
  { id: "studio", label: "Studio White", desc: "Bright professional" },
  { id: "neon", label: "Neon RGB", desc: "Colorful LED accents" },
  { id: "moody", label: "Moody Low", desc: "Dim atmospheric tones" },
];
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Calendar } from "@/components/ui/calendar";
import { format, addDays, isBefore, startOfDay } from "date-fns";
import logo from "@/assets/logo.png";

// 90-minute sessions, every 30 min, last slot starts 6:30 PM (ends 8:00 PM)
const TIME_SLOTS = (() => {
  const slots: string[] = [];
  // 10:00 AM (600 min) through 6:30 PM (1110 min), step 30
  for (let mins = 10 * 60; mins <= 18 * 60 + 30; mins += 30) {
    const h24 = Math.floor(mins / 60);
    const m = mins % 60;
    const period = h24 >= 12 ? "PM" : "AM";
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    slots.push(`${h12}:${String(m).padStart(2, "0")} ${period}`);
  }
  return slots;
})();

const PromoRedeem = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [promo, setPromo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [step, setStep] = useState<"code" | "schedule" | "consent" | "confirmed">("code");
  const [error, setError] = useState("");
  const [roomTitle, setRoomTitle] = useState("");

  // Scheduling state
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Auth state
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<HCaptcha>(null);

  // Style selections
  const [selectedLayout, setSelectedLayout] = useState("");
  const [selectedLighting, setSelectedLighting] = useState("");

  // Consent state
  const [consentSignature, setConsentSignature] = useState<string | null>(null);
  const [consentSignerName, setConsentSignerName] = useState("");
  const [consentExpanded, setConsentExpanded] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch booked slots when date or roomTitle changes
  useEffect(() => {
    if (!selectedDate || !roomTitle) return;
    setSelectedTime("");
    setLoadingSlots(true);
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    supabase
      .from("bookings")
      .select("booking_time")
      .eq("booking_date", dateStr)
      .eq("room_title", roomTitle)
      .in("payment_status", ["paid", "promo"])
      .neq("booking_time", "TBD - Free Session")
      .then(({ data }) => {
        const taken = (data || []).map((b: any) => {
          // Extract base time like "10:00 AM" from "10:00 AM (1.5 hrs)" or "10:00 AM - 11:30 AM"
          const match = b.booking_time?.match(/^\d{1,2}:\d{2}\s?[AP]M/i);
          return match ? match[0] : b.booking_time;
        });
        setBookedSlots(taken);
        setLoadingSlots(false);
      });
  }, [selectedDate, roomTitle]);

  useEffect(() => {
    loadPromo();
  }, [token]);

  const loadPromo = async () => {
    if (!token) return;
    setLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("validate-promo-token", {
        body: { token },
      });

      if (fnError) throw fnError;

      if (data?.error) {
        setError(data.error);
      } else if (data?.redeemed) {
        setError("This promo has already been redeemed.");
      } else {
        setPromo(data);
      }
    } catch {
      setError("This promo link is invalid or has expired.");
    }

    setLoading(false);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaToken) {
      toast({ title: "Verify you're human", description: "Please complete the captcha.", variant: "destructive" });
      return;
    }
    setAuthLoading(true);
    try {
      if (authMode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name }, captchaToken },
        });
        if (error) throw error;
        toast({
          title: "Account created!",
          description: "Check your email to verify your account, then sign in below.",
        });
        setAuthMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
          options: { captchaToken },
        });
        if (error) throw error;
        toast({ title: "Signed in!" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAuthLoading(false);
      // hCaptcha tokens are single-use — reset so the next attempt (e.g. the
      // sign-in that follows a successful signup) gets a fresh one.
      setCaptchaToken(null);
      captchaRef.current?.resetCaptcha();
    }
  };

  const handleRedeem = async () => {
    if (code.length !== 7) {
      toast({ title: "Enter the full 7-digit code", variant: "destructive" });
      return;
    }
    setRedeeming(true);
    try {
      const { data, error } = await supabase.functions.invoke("redeem-promo", {
        body: { token, code },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setRoomTitle(data.room_title);
      setStep("schedule");
      toast({ title: "Code verified! 🎉", description: "Now pick your session date & time." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setRedeeming(false);
    }
  };

  const handleSchedule = () => {
    if (!selectedDate || !selectedTime) {
      toast({ title: "Select a date and time", variant: "destructive" });
      return;
    }
    // Pre-fill signer name from auth metadata if available
    if (!consentSignerName) {
      setConsentSignerName(user?.user_metadata?.display_name || "");
    }
    setStep("consent");
  };

  const handleConfirmConsent = async () => {
    if (!consentSignature || !consentSignerName.trim()) {
      toast({ title: "Please sign and enter your full legal name", variant: "destructive" });
      return;
    }
    if (!selectedDate || !selectedTime) return;
    setScheduling(true);
    try {
      // Upload signature to private bucket
      let consentSignaturePath: string | null = null;
      try {
        const blob = dataUrlToBlob(consentSignature);
        const path = `${user.id}/${crypto.randomUUID()}.png`;
        const { error: upErr } = await supabase.storage
          .from("consent-signatures")
          .upload(path, blob, { contentType: "image/png" });
        if (!upErr) consentSignaturePath = path;
      } catch (e) {
        console.error("Signature upload failed", e);
      }

      const { data, error } = await supabase.functions.invoke("schedule-promo-session", {
        body: {
          token,
          booking_date: format(selectedDate, "yyyy-MM-dd"),
          booking_time: `${selectedTime} (1.5 hrs)`,
          layout: selectedLayout || null,
          lighting: selectedLighting || null,
          consent_signature_path: consentSignaturePath,
          consent_signer_name: consentSignerName.trim(),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.invite_token) setInviteToken(data.invite_token);
      setStep("confirmed");
      toast({ title: "Session scheduled! 🎶" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setScheduling(false);
    }
  };

  // Earliest bookable date is 2 days after today (booking happens at redemption time)
  const earliestDate = startOfDay(addDays(new Date(), 2));
  const today = startOfDay(new Date());

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <h1 className="font-display text-lg font-bold text-foreground">{error}</h1>
          <button onClick={() => navigate("/")} className="text-muted-foreground text-sm font-body hover:text-foreground underline underline-offset-4">
            Go to homepage
          </button>
        </motion.div>
      </div>
    );
  }

  // Confirmed state
  if (step === "confirmed") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-6 max-w-sm">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto" />
          <h1 className="font-display text-xl font-bold text-foreground">Session Booked! 🎶</h1>
          <div className="chrome-surface rounded-lg p-5 space-y-2 text-left">
            <p className="text-foreground font-display font-semibold">{roomTitle}</p>
            <p className="text-muted-foreground text-xs font-body flex items-center gap-1.5">
              <CalendarIcon className="w-3 h-3" /> {selectedDate && format(selectedDate, "EEEE, MMMM d, yyyy")}
            </p>
            <p className="text-muted-foreground text-xs font-body flex items-center gap-1.5">
              <Clock className="w-3 h-3" /> {selectedTime} · 1.5 hours
            </p>
            {selectedLayout && (
              <p className="text-muted-foreground text-xs font-body">
                <span className="text-foreground/70">Layout:</span>{" "}
                {LAYOUT_OPTIONS.find((o) => o.id === selectedLayout)?.label}
              </p>
            )}
            {selectedLighting && (
              <p className="text-muted-foreground text-xs font-body">
                <span className="text-foreground/70">Lighting:</span>{" "}
                {LIGHTING_OPTIONS.find((o) => o.id === selectedLighting)?.label}
              </p>
            )}
            <div className="border-t border-border pt-2 mt-2">
              <p className="text-green-400 font-display font-bold text-sm">FREE (Promo)</p>
            </div>
          </div>
          <p className="text-muted-foreground text-xs font-body">A confirmation has been sent to your email.</p>

          {inviteToken && (
            <div className="chrome-surface rounded-lg p-4 space-y-3 text-left">
              <div>
                <p className="text-foreground font-display font-semibold text-sm">Invite up to 2 guests</p>
                <p className="text-muted-foreground text-[11px] font-body mt-1">
                  Share this link with your guests. They'll need to verify their ID to be added to the booking. More guests available on request.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[10px] font-mono text-muted-foreground bg-card border border-border/30 rounded px-2 py-1.5 truncate">
                  {`${window.location.origin}/session/${inviteToken}`}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/session/${inviteToken}`);
                    setCopiedInvite(true);
                    toast({ title: "Invite link copied!" });
                    setTimeout(() => setCopiedInvite(false), 2000);
                  }}
                  className="shrink-0 px-3 py-1.5 rounded-md bg-card border border-border/30 text-foreground text-[11px] font-display uppercase tracking-wider hover:bg-accent transition-colors"
                >
                  {copiedInvite ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          )}

          <button
            onClick={() => navigate("/profile")}
            className="chrome-btn font-display font-semibold text-sm uppercase tracking-[0.15em] px-6 py-3 rounded-md"
          >
            View Profile
          </button>
        </motion.div>
      </div>
    );
  }

  // Schedule step
  if (step === "schedule") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <img src={logo} alt="Replay Club" className="w-36 mx-auto mb-3 mix-blend-screen" />
            <h1 className="font-display text-lg font-bold text-foreground">Choose Your Session</h1>
            <p className="text-muted-foreground text-sm font-body mt-1">
              Free <strong className="text-foreground">{roomTitle}</strong> · 1.5 hours
            </p>
          </div>

          {/* Date Picker */}
          <div className="chrome-surface rounded-lg p-4 space-y-3">
            <label className="text-foreground font-body text-xs uppercase tracking-wider flex items-center gap-1.5">
              <CalendarIcon className="w-3 h-3" /> Select Date
            </label>
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => isBefore(date, earliestDate)}
                className="p-3 pointer-events-auto rounded-md border border-border"
              />
            </div>
          </div>

          {/* Time Slots */}
          {selectedDate && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="chrome-surface rounded-lg p-4 space-y-3">
              <label className="text-foreground font-body text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> Select Time
              </label>
              <p className="text-muted-foreground text-[10px] font-body">
                Each session is 1 hour 30 minutes. Last slot ends by 8:00 PM.
              </p>
              {loadingSlots ? (
                <div className="flex justify-center py-4">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {TIME_SLOTS.map((slot) => {
                    const isBooked = bookedSlots.includes(slot);
                    return (
                      <button
                        key={slot}
                        onClick={() => !isBooked && setSelectedTime(slot)}
                        disabled={isBooked}
                        className={`px-3 py-2.5 rounded-md text-sm font-display font-semibold transition-all border ${
                          isBooked
                            ? "bg-muted border-border text-muted-foreground/40 cursor-not-allowed line-through"
                            : selectedTime === slot
                              ? "bg-foreground text-background border-foreground"
                              : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/50"
                        }`}
                      >
                        {slot}
                        {isBooked && <span className="block text-[9px] font-body font-normal no-underline" style={{ textDecoration: 'none' }}>Booked</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* Room Style */}
          {selectedDate && selectedTime && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="chrome-surface rounded-lg p-4 space-y-4">
              <label className="text-foreground font-body text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Palette className="w-3 h-3" /> Room Style <span className="text-muted-foreground/60 normal-case tracking-normal">(optional)</span>
              </label>

              <div className="space-y-2">
                <p className="text-muted-foreground text-[10px] font-body uppercase tracking-wider">Layout</p>
                <div className="grid grid-cols-2 gap-2">
                  {LAYOUT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedLayout(selectedLayout === opt.id ? "" : opt.id)}
                      className={`text-left px-3 py-2 rounded-md text-xs font-display transition-all border ${
                        selectedLayout === opt.id
                          ? "bg-foreground text-background border-foreground"
                          : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/50"
                      }`}
                    >
                      <div className="font-semibold">{opt.label}</div>
                      <div className={`text-[9px] font-body mt-0.5 ${selectedLayout === opt.id ? "text-background/70" : "text-muted-foreground/70"}`}>
                        {opt.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-muted-foreground text-[10px] font-body uppercase tracking-wider">Lighting</p>
                <div className="grid grid-cols-2 gap-2">
                  {LIGHTING_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedLighting(selectedLighting === opt.id ? "" : opt.id)}
                      className={`text-left px-3 py-2 rounded-md text-xs font-display transition-all border ${
                        selectedLighting === opt.id
                          ? "bg-foreground text-background border-foreground"
                          : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/50"
                      }`}
                    >
                      <div className="font-semibold">{opt.label}</div>
                      <div className={`text-[9px] font-body mt-0.5 ${selectedLighting === opt.id ? "text-background/70" : "text-muted-foreground/70"}`}>
                        {opt.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Continue to Consent */}
          {selectedDate && selectedTime && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <button
                onClick={handleSchedule}
                className="w-full chrome-btn font-display font-semibold text-sm uppercase tracking-[0.15em] px-6 py-3 rounded-md"
              >
                Continue to Consent →
              </button>
            </motion.div>
          )}

          <button
            onClick={() => navigate("/")}
            className="block mx-auto text-muted-foreground text-xs font-body hover:text-foreground transition-colors"
          >
            ← Back to home
          </button>
        </motion.div>
      </div>
    );
  }

  // Consent step
  if (step === "consent") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm space-y-5">
          <div className="text-center">
            <img src={logo} alt="Replay Club" className="w-32 mx-auto mb-3 mix-blend-screen" />
            <div className="flex items-center justify-center gap-2 mb-1">
              <FileSignature className="w-4 h-4 text-foreground" />
              <h1 className="font-display text-base font-bold text-foreground uppercase tracking-[0.15em]">Studio Consent</h1>
            </div>
            <p className="text-muted-foreground text-xs font-body">
              Please review and sign to confirm your free session.
            </p>
          </div>

          <div className="chrome-surface rounded-lg p-4 space-y-3">
            <div className="border border-border rounded-md overflow-hidden">
              <button
                type="button"
                onClick={() => setConsentExpanded(!consentExpanded)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-secondary/50 transition-colors"
              >
                <span className="text-[10px] font-display font-semibold uppercase tracking-[0.15em] text-foreground">
                  Read Full Agreement
                </span>
                <span className="text-muted-foreground text-xs">{consentExpanded ? "−" : "+"}</span>
              </button>
              {consentExpanded && (
                <div className="px-3 pb-3 text-[10px] font-body text-muted-foreground space-y-2 border-t border-border pt-2 max-h-56 overflow-y-auto">
                  <p><span className="text-foreground font-semibold">1. Assumption of Risk & Liability Waiver.</span> I voluntarily participate in activities at Replay Club and assume all risk of injury, loss, or damage to person or property. I release Replay Club, its owners, staff, and affiliates from any and all claims arising from my use of the studio.</p>
                  <p><span className="text-foreground font-semibold">2. Right to Refuse Service.</span> Replay Club reserves the right to refuse entry, terminate a session without refund, and remove any guest who violates studio policy, behaves unsafely, or is impaired.</p>
                  <p><span className="text-foreground font-semibold">3. Surveillance Consent.</span> The premises are continuously monitored by audio/video recording for safety and security. By entering, I consent to being recorded.</p>
                  <p><span className="text-foreground font-semibold">4. Promotional Media Release.</span> I grant Replay Club a perpetual, royalty-free license to use photos, video, and audio captured on premises for promotional purposes, unless I opt out in writing before the session.</p>
                  <p><span className="text-foreground font-semibold">5. Address Confidentiality.</span> The studio's physical address, entry code, and access details are confidential. I will not publish, post, tag, or share them on social media or any public platform.</p>
                  <p><span className="text-foreground font-semibold">6. Conduct & Damages.</span> I am financially responsible for any damage I or my guests cause to equipment, furnishings, or the premises. No smoking, illegal substances, or unauthorized commercial activity.</p>
                  <p><span className="text-foreground font-semibold">7. Intellectual Property.</span> Original creative work I produce during the session remains my property. Replay Club retains rights to its branding, environment, and equipment imagery.</p>
                  <p><span className="text-foreground font-semibold">8. Guest Responsibility.</span> I am responsible for the conduct of any guests I bring. All attendees must comply with this agreement.</p>
                  <p><span className="text-foreground font-semibold">9. Cancellation.</span> Reschedule or cancel ≥24 hours in advance. Late cancellations and no-shows are non-refundable.</p>
                  <p><span className="text-foreground font-semibold">10. Governing Law.</span> This agreement is governed by the laws of the State of California. Any disputes will be resolved in Los Angeles County.</p>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-display font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                Your Full Legal Name
              </label>
              <input
                value={consentSignerName}
                onChange={(e) => setConsentSignerName(e.target.value)}
                placeholder="As it appears on your ID"
                className="w-full bg-background text-foreground border border-border rounded-md px-3 py-2 text-xs font-body focus:outline-none focus:border-chrome-dark transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-display font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                Guest Signature
              </label>
              <SignaturePad onChange={setConsentSignature} />
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-display font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  Studio Representative
                </label>
                <span className="text-[9px] font-body text-foreground/70 uppercase tracking-wider">✓ Auto-signed</span>
              </div>
              <div className="rounded-md border border-border bg-secondary/40 p-2">
                <StudioRepSignature className="w-full h-16" />
                <p className="text-[9px] text-muted-foreground font-body text-center mt-1">
                  Replay Club · Authorized Representative · {format(new Date(), "MMM d, yyyy")}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleConfirmConsent}
            disabled={scheduling || !consentSignature || !consentSignerName.trim()}
            className="w-full chrome-btn font-display font-semibold text-sm uppercase tracking-[0.15em] px-6 py-3 rounded-md disabled:opacity-50"
          >
            {scheduling ? "Confirming..." : "Sign & Confirm Session"}
          </button>

          <button
            onClick={() => setStep("schedule")}
            className="block mx-auto text-muted-foreground text-xs font-body hover:text-foreground transition-colors"
          >
            ← Back to schedule
          </button>
        </motion.div>
      </div>
    );
  }

  // Code entry / Auth step
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <img
            src={logo}
            alt="Replay Club"
            className="w-48 mx-auto mb-4 mix-blend-screen cursor-pointer"
            onClick={() => navigate("/")}
          />
          <div className="inline-flex items-center gap-2 bg-accent/50 text-accent-foreground text-[10px] font-display font-semibold uppercase tracking-wider px-4 py-1.5 rounded-full mb-4">
            <Gift className="w-3 h-3" /> Free Session
          </div>
          <h1 className="font-display text-lg font-bold text-foreground">
            Free {promo.room_title}
          </h1>
          <p className="text-muted-foreground text-sm font-body mt-1">
            You've been invited to a complimentary session
          </p>
        </div>

        {!user ? (
          <div className="space-y-6">
            <p className="text-center text-muted-foreground text-xs font-body">
              {authMode === "signup" ? "Create an account to claim your session" : "Sign in to continue"}
            </p>
            <form onSubmit={handleAuth} className="space-y-4">
              {authMode === "signup" && (
                <div className="space-y-2">
                  <label className="text-foreground font-body text-xs uppercase tracking-wider">Display Name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full bg-card border border-border text-foreground rounded-md px-3 py-2 text-sm font-body focus:outline-none focus:ring-1 focus:ring-ring"
                    required
                  />
                </div>
              )}
              <div className="space-y-2">
                <label className="text-foreground font-body text-xs uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-card border border-border text-foreground rounded-md px-3 py-2 text-sm font-body focus:outline-none focus:ring-1 focus:ring-ring"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-foreground font-body text-xs uppercase tracking-wider">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-card border border-border text-foreground rounded-md px-3 py-2 text-sm font-body focus:outline-none focus:ring-1 focus:ring-ring"
                  required
                  minLength={6}
                />
              </div>
              <HCaptchaWidget
                ref={captchaRef}
                onVerify={(token) => setCaptchaToken(token)}
                onExpire={() => setCaptchaToken(null)}
              />
              <button
                type="submit"
                disabled={authLoading || !captchaToken}
                className="w-full chrome-btn font-display font-semibold text-sm uppercase tracking-[0.15em] px-6 py-3 rounded-md disabled:opacity-50"
              >
                {authLoading ? "..." : authMode === "signup" ? "Create Account" : "Sign In"}
              </button>
            </form>
            <p className="text-center text-muted-foreground text-sm font-body">
              {authMode === "signup" ? "Already have an account?" : "Need an account?"}{" "}
              <button
                onClick={() => setAuthMode(authMode === "signup" ? "login" : "signup")}
                className="text-foreground underline underline-offset-4 hover:text-primary transition-colors"
              >
                {authMode === "signup" ? "Sign in" : "Sign up"}
              </button>
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="chrome-surface rounded-lg p-6 space-y-4">
              <p className="text-center text-muted-foreground text-xs font-body">
                Check your email for the 7-digit redemption code
              </p>
              <div className="flex justify-center">
                <InputOTP maxLength={7} value={code} onChange={setCode}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                    <InputOTPSlot index={6} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <button
                onClick={handleRedeem}
                disabled={redeeming || code.length !== 7}
                className="w-full chrome-btn font-display font-semibold text-sm uppercase tracking-[0.15em] px-6 py-3 rounded-md disabled:opacity-50"
              >
                {redeeming ? "Redeeming..." : "Redeem Free Session"}
              </button>
            </div>
            <p className="text-center text-muted-foreground text-[10px] font-body">
              Signed in as {user.email}
            </p>
          </div>
        )}

        <button
          onClick={() => navigate("/")}
          className="block mx-auto text-muted-foreground text-xs font-body hover:text-foreground transition-colors"
        >
          ← Back to home
        </button>
      </motion.div>
    </div>
  );
};

export default PromoRedeem;
