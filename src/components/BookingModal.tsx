import { useState, useEffect, useRef, useTransition, useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  readBookingDraft,
  writeBookingDraft,
  clearBookingDraft,
} from "@/lib/bookingDraftStorage";
import { Calendar } from "@/components/ui/calendar";
import { cn, dataUrlToBlob } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { rentalPriceMap, lightingOptions } from "@/components/CustomizeSession";
import { BACKDROPS } from "@/components/BackdropsGallery";
import { useEffectiveBackdrops } from "@/hooks/useBackdrops";
import { supabase } from "@/integrations/supabase/client";
import {
  ROOM_EQUIPMENT_RENTAL,
  TRANSACTION_FEE_CENTS,
  PHOTO_PACKAGES,
  ADDON_BUNDLES,
} from "@/lib/bookingConstants";
import {
  getTimeSlotsForRoom,
  applyBufferToUnavailable,
} from "@/lib/bookingTimeSlots";
import { useBookingDensitySettings, BOOKING_DENSITY_DEFAULTS } from "@/lib/bookingDensitySettings";
import { Clock, Bell, Gift, Loader2, Check, Camera, ShieldCheck, FileSignature, Tag, ChevronDown, Lock, Mail, Maximize2 } from "lucide-react";
import ImageLightbox from "@/components/ImageLightbox";
import SignaturePad from "@/components/SignaturePad";
import StudioRepSignature from "@/components/StudioRepSignature";
import IdCameraCapture from "@/components/IdCameraCapture";
import { reportBookingFailure } from "@/lib/bookingFailureReporter";
import { bootstrapKey } from "@/lib/prefetchBookingBootstrap";
import { DOB_MONTHS, DOB_YEARS, validateDob } from "@/lib/dob";
import HCaptchaWidget from "@/components/HCaptchaWidget";
import type HCaptcha from "@hcaptcha/react-hcaptcha";
import { useInlineSignup } from "@/hooks/useInlineSignup";
import {
  EQUIPMENT_TURNAROUND_BUFFER_DAYS,
  logEquipmentBlockEvent,
} from "@/lib/serviceEquipmentDependencies";
import {
  useRequiredEquipment,
  useServiceEquipmentRequirements,
} from "@/hooks/useServiceEquipmentRequirements";
import { trackInitiateCheckout } from "@/lib/metaPixel";
import { usePublicSiteSettings, BOOKING_POLICY_DEFAULTS } from "@/hooks/useSiteSettings";

// Stable empty fallback so React Query's default doesn't recreate a new Set
// each render (avoids breaking memoization downstream).
const EMPTY_DATE_SET: Set<string> = new Set();
const EMPTY_TIME_MAP: Map<string, Set<string>> = new Map();

interface BookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: { title: string; price: string; tiers?: string[]; minHours?: number } | null;
  selectedEquipment?: string[];
  sessionSelections?: { lighting: string; sound: string; layout: string };
  /**
   * Features (bullet points) for each tier string, keyed by the full tier
   * string as it appears in `room.tiers`. Sourced from
   * studio_configurations.tiers — admin-editable at /admin/services. When
   * present and non-empty for a tier, BookingModal renders the features as
   * a dropdown beneath the selected tier button.
   */
  tierFeatures?: Record<string, string[]>;
  /** Optional step label to open on (e.g. "Date", "Time", "Pay"). Falls back to first step. */
  initialStep?: string;
  /**
   * When the user returns from Stripe Identity (PR 4a "new flow"), Index.tsx
   * detects /?book=resume&booking=<id>, hydrates the draft from the bookings
   * row, and passes the booking id here so the modal:
   *   - Skips the bootstrap-driven seeding for fields already on the row
   *   - Lands on the Consent step (verification just completed)
   *   - Sends `existingBookingId` to create-booking-payment at Pay
   * Optional; legacy flow doesn't use this.
   */
  resumeBookingId?: string | null;
  /**
   * Notifies the parent whenever the visible step changes. The parent
   * mirrors the step into the URL (?step=<label>) so browser back/forward
   * and the iOS swipe-back gesture map onto modal step navigation.
   */
  onStepChange?: (label: string) => void;
  /**
   * Pre-fill from the inline booking form on a service landing page. Index.tsx
   * passes these when /?book=<slug>&date=...&time=...&tier_idx=... is hit.
   * They're applied once on open; the modal then starts at initialStep
   * (typically "Customize"). Avoids resetting if the user has already
   * picked something in the modal.
   */
  initialDate?: string;
  initialTime?: string;
  initialTierLabel?: string;
  initialBackdrop?: string;
  initialHours?: number;
  // Seeded on resume (post-Stripe) from the existing booking row so the Consent
  // gate (consentSignature && name.trim()) can pass — bootstrap alone is empty
  // for a fresh guest. See the resume paths in Index.tsx + ServiceLandingPage.tsx.
  initialName?: string;
  initialPhone?: string;
  /**
   * Presentational shell. "modal" (default) renders the flow inside the popup
   * Dialog; "inline" renders it as a plain page section for the inline
   * single-page booking flow on service landing pages.
   */
  variant?: "modal" | "inline";
}

/**
 * Presentational shell for the booking flow. `variant="modal"` wraps the flow
 * in the popup Dialog (legacy); `variant="inline"` renders it as a plain page
 * section for the inline single-page booking flow. The flow body (children) is
 * identical in both — only the wrapper and header element differ.
 */
const BookingFlowShell = ({
  variant,
  open,
  onDialogOpenChange,
  room,
  email,
  requiredEquipment,
  isEquipmentRental,
  children,
}: {
  variant: "modal" | "inline";
  open: boolean;
  onDialogOpenChange: (open: boolean) => void;
  room: { title: string; price: string } | null;
  email: string;
  requiredEquipment: string[];
  isEquipmentRental: boolean;
  children: ReactNode;
}) => {
  const headerExtras = (
    <>
      <p className="text-muted-foreground text-sm font-body">{room?.price}</p>
      {email && (
        <p
          className="text-[11px] font-body text-muted-foreground/90 mt-1 inline-flex items-center gap-1.5"
          title="Account you're booking with — switch accounts before paying if this is wrong"
        >
          <Mail className="w-3 h-3 text-primary/70" />
          <span>
            Booking as <span className="text-foreground font-semibold">{email}</span>
          </span>
        </p>
      )}
      {requiredEquipment.length > 0 && !isEquipmentRental && (
        <p className="text-[10px] font-body text-primary/80 uppercase tracking-[0.15em] mt-1 inline-flex items-center gap-1.5">
          <Check className="w-3 h-3" />
          Includes {requiredEquipment.join(", ")}
        </p>
      )}
    </>
  );

  if (variant === "inline") {
    return (
      <section className="card-premium card-premium-accent rounded-xl p-4 sm:p-6">
        <div className="pr-8 mb-3">
          <h2 className="font-display text-lg chrome-text">Book {room?.title}</h2>
          {headerExtras}
        </div>
        {children}
      </section>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onDialogOpenChange}>
      <DialogContent
        className={cn(
          "card-premium card-premium-accent overflow-y-auto",
          // Mobile: take full screen so all steps/CTAs are reachable.
          "max-sm:w-screen max-sm:h-[100dvh] max-sm:max-w-none max-sm:max-h-[100dvh] max-sm:rounded-none max-sm:p-4 max-sm:pt-12",
          // Desktop keeps the original centered card.
          "sm:max-w-md"
        )}
      >
        <DialogHeader className="pr-8">
          <DialogTitle className="font-display text-lg chrome-text">
            Book {room?.title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Choose your booking date, package, verification details, consent, and payment options.
          </DialogDescription>
          {headerExtras}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
};

// Parse tier price like "$75/hr — gear only" → 7500 (cents per hour).
// The hourly amount is the FIRST `$N` token in the string.
const parseTierPrice = (tier: string): number => {
  const match = tier.match(/\$(\d+)/);
  return match ? parseInt(match[1]) * 100 : 0;
};

// Parse a flat add-on amount, e.g. "$60/hr — Audio + Full Edit (+$150 flat)" → 15000 (cents).
// Applied ONCE per booking, not multiplied by hours. Returns 0 when none present.
const parseTierFlatAddOn = (tier: string): number => {
  const match = tier.match(/\+\s*\$(\d+)\s*flat/i);
  return match ? parseInt(match[1]) * 100 : 0;
};

const createLocalCalendarDate = (year: number, month: number, day: number): Date | undefined => {
  const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  ) {
    return parsed;
  }
  return undefined;
};

const parseStoredBookingDate = (value?: string | null): Date | undefined => {
  if (!value) return undefined;

  const trimmed = value.trim();
  const isoDate = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  if (isoDate) {
    return createLocalCalendarDate(Number(isoDate[1]), Number(isoDate[2]), Number(isoDate[3]));
  }

  const dayMonthYear = trimmed.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (dayMonthYear) {
    const day = Number(dayMonthYear[1]);
    const month = Number(dayMonthYear[2]);
    const year = Number(dayMonthYear[3].length === 2 ? `20${dayMonthYear[3]}` : dayMonthYear[3]);
    return createLocalCalendarDate(year, month, day);
  }

  if (/^\d+$/.test(trimmed)) {
    const parsed = new Date(Number(trimmed));
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  return undefined;
};

const getTodayAtLocalMidnight = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
};

const createUuid = () => {
  if (typeof crypto !== "undefined") {
    if (typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }

    if (typeof crypto.getRandomValues === "function") {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
      return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
    }
  }

  return `fallback-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const BookingModal = ({ open, onOpenChange, room, selectedEquipment, sessionSelections, tierFeatures, initialStep, resumeBookingId, onStepChange, initialDate, initialTime, initialTierLabel, initialBackdrop, initialHours, initialName, initialPhone, variant = "modal" }: BookingModalProps) => {
  // Per-room draft storage so partially completed bookings survive close/reopen
  // and deep-linking. Cleared on successful payment redirect or manual reset.
  const draftKey = room?.title ? `booking-draft:${room.title}` : null;
  const draftHydrated = useRef(false);

  const [step, setStep] = useState(0);
  const [draftReady, setDraftReady] = useState(false);
  // When a non-empty draft is detected on open, surface a Continue / Start Over
  // prompt before silently restoring stale selections.
  const [resumePromptOpen, setResumePromptOpen] = useState(false);
  const pendingDraftRef = useRef<null | Record<string, unknown>>(null);
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState<string>();
  const [hours, setHours] = useState(2);
  const [selectedTier, setSelectedTier] = useState<string>();
  // Customize step (Backdrop + Lighting) — added 2026-05-11. Both required to
  // advance from "Customize" step (see maxReachableStep). Sentinel values
  // "__none__" / "__default__" let users explicitly opt out while still
  // satisfying the required-selection rule.
  const [selectedBackdrop, setSelectedBackdrop] = useState<string | null>(null);
  // Inline flow: lighting isn't collected on the landing page, so default it
  // to the "studio picks" sentinel — otherwise the merged Tier/Customize step
  // never registers as complete and the inline modal re-shows the pickers.
  const [selectedLighting, setSelectedLighting] = useState<string | null>(
    variant === "inline" ? "__default__" : null,
  );
  // Free-form text the client can use to tell the studio about special
  // requests (gear preferences, vibe references, accessibility notes, etc.).
  // 500-char cap. Visible to admin on the booking record.
  const [customRequests, setCustomRequests] = useState<string>("");
  // Backdrop preview lightbox — index = which backdrop image to open at.
  // -1 means closed. Click the expand icon on any backdrop tile to open.
  const [backdropPreviewIndex, setBackdropPreviewIndex] = useState<number>(-1);
  // Admin-managed dynamic backdrop list (image, description, sort_order, etc.)
  // Falls back to bundled seed when DB is empty/unreachable so booking never
  // breaks. Realtime subscription means admin photo edits propagate live.
  // Universal backdrops: all services share the same physical backdrops
  // (Replay Club has one set of drapes on one wall). DJ's Layouts is the
  // canonical source — admin edits there once and every booking flow
  // sees the same options. We can promote to a dedicated `backdrops`
  // table later when Lovable resolves the app_role situation.
  const effectiveBackdrops = useEffectiveBackdrops("dj");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  // Legacy flow requires phone for SMS/day-of contact. PR 4a Stripe Identity
  // flow treats it as optional and prefills from the authenticated account
  // when available.
  const [phone, setPhone] = useState("");
  const [authLoaded, setAuthLoaded] = useState(false);
  // Current auth identity, resolved from the Supabase session. Drives the
  // booking-bootstrap cache key (via bootstrapKey) so a guest-prefetched
  // { user: null } (keyed "anon") is never served to a signed-in modal.
  // `undefined` = not yet resolved → the query stays disabled so its FIRST
  // fetch always uses the correct identity (no anon→user key flip mid-flight).
  const [authUserId, setAuthUserId] = useState<string | null | undefined>(undefined);
  // A guest = auth resolved (not undefined) AND no session. Drives the dual-mode
  // checkout step: guests get the inline "your details" account form; signed-in
  // users get today's read-only confirm fields. (Layer 2 Chunk 2.)
  const isGuest = authUserId === null;
  // Layer 2 inline account fields (guest checkout). Field state only at this
  // checkpoint (B1) — the submit/OTP state machine is wired in later checkpoints.
  const [password, setPassword] = useState("");
  const [dobMonth, setDobMonth] = useState("");
  const [dobDay, setDobDay] = useState("");
  const [dobYear, setDobYear] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const inlineSignup = useInlineSignup();
  // A2 OTP sub-step (guest checkout, confirmation-required state). `awaitingOtp`
  // flips on when signUp returns needs_otp; the render swaps the details form for
  // the 6-digit code input.
  const [otpCode, setOtpCode] = useState("");
  const [awaitingOtp, setAwaitingOtp] = useState(false);
  // Inline sign-in sub-step: flips on when signUp reports the email already has
  // an account, so the guest signs in (password) instead of creating a new one.
  const [loginMode, setLoginMode] = useState(false);
  // Ref to reset the hCaptcha widget after a failed signUp (token is single-use).
  const guestCaptchaRef = useRef<HCaptcha>(null);
  // Track which contact fields the user has touched, so we only show
  // "this is required" errors after they leave a field empty — never
  // while they're still typing.
  const [touched, setTouched] = useState<{ name?: boolean; email?: boolean; phone?: boolean }>({});
  const [verificationCode, setVerificationCode] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  // Resend rate limit per session: 1 per 60s, max 3 total resends. Counted
  // separately from `sending` so the UI can show "Resend in Xs" vs disable
  // entirely after the cap.
  const [resendCount, setResendCount] = useState(0);
  const RESEND_MAX_PER_SESSION = 3;
  // Timestamp of the most recent successful send — drives the
  // "Code sent X seconds ago" label.
  const [codeSentAt, setCodeSentAt] = useState<number | null>(null);
  const [codeSentSecondsAgo, setCodeSentSecondsAgo] = useState(0);
  // Inline error for invalid code (replaces toast — feels less noisy when
  // user mistypes a digit).
  const [verifyError, setVerifyError] = useState<string | null>(null);
  // Tracks whether we've kicked off the auto-send for this Verify step
  // mount, so re-renders don't re-fire the send.
  const autoSentRef = useRef(false);
  // Mobile: keyboard timing varies. autoFocus alone doesn't reliably
  // scroll the input into view above the keyboard on iPhone SE / smaller
  // Androids. We add a delayed scrollIntoView as a safety net.
  const verifyInputRef = useRef<HTMLInputElement | null>(null);
  const [paying, setPaying] = useState(false);
  // Idempotency key for the in-flight Stripe checkout — generated lazily and
  // reused across retries so double-clicks don't create duplicate sessions.
  const [stripeIdempotencyKey, setStripeIdempotencyKey] = useState<string | null>(null);
  // Other-user contention indicator (soft warning before Pay step)
  const [otherViewers, setOtherViewers] = useState(0);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsExpanded, setTermsExpanded] = useState(false);
  // Three individual policy acknowledgments — each must be checked to enable
  // checkout. Mapped 1:1 to client_intake.agreed_policies / agreed_cancellation
  // / agreed_code_of_conduct columns (no schema change). Kept derived
  // Master consent timestamp captured the moment the user ticks the single
  // "I have read and agree" checkbox at the Pay step. Stored alongside the
  // booking record (consent_accepted_at / consent_version / consent_accepted)
  // so future legal disputes can reference exactly what was shown.
  const [consentAcceptedAt, setConsentAcceptedAt] = useState<string | null>(null);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [lockedSlots, setLockedSlots] = useState<string[]>([]);
  const [dayBookingCount, setDayBookingCount] = useState(0);
  // Re-tick every 60s so "too close to now" slots auto-disable while the
  // user sits on the booking step. Used to compute disabled state for today.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNowTick(Date.now()), 60_000);
    return () => clearInterval(t);
  }, [open]);
  // Admin-configurable booking policies. Falls back to current behaviour.
  const { settings: publicSettings } = usePublicSiteSettings();
  const leadMinutes =
    publicSettings.booking_lead_minutes ?? BOOKING_POLICY_DEFAULTS.leadMinutes;
  const lookaheadDays =
    publicSettings.booking_lookahead_days ?? BOOKING_POLICY_DEFAULTS.lookaheadDays;
  // Track when the slot availability query is in flight so we can render
  // skeleton tiles instead of a blank grid (was a ~500ms empty area).
  const [slotsLoading, setSlotsLoading] = useState(false);
  // Resend cooldown (seconds remaining) for the verification email.
  const [resendIn, setResendIn] = useState(0);
  // useTransition keeps step changes responsive on slower devices by marking
  // the heavy re-render (motion + many sub-sections) as non-urgent.
  const [, startStepTransition] = useTransition();
  // Auto-advance from the merged Date+Time step after the user picks a time.
  // 600ms is long enough for an undo toast to be useful but short enough to
  // feel snappy. Cancelled if the user changes the time again or moves away.
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelAutoAdvance = () => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  };
  // Active reservation hold this user has on the slot they're currently checking out
  const [holdLockId, setHoldLockId] = useState<string | null>(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState<number | null>(null);
  const [holdRemainingMs, setHoldRemainingMs] = useState<number>(0);
  const [joiningWaitlist, setJoiningWaitlist] = useState(false);
  const [loyaltyDiscount, setLoyaltyDiscount] = useState<{ tier: string; percent: number } | null>(null);
  const [giftCardCode, setGiftCardCode] = useState("");
  const [giftCardApplied, setGiftCardApplied] = useState<{ code: string; balanceCents: number; id: string } | null>(null);
  const [giftCardError, setGiftCardError] = useState("");
  const [applyingGiftCard, setApplyingGiftCard] = useState(false);
  const [discountCodeInput, setDiscountCodeInput] = useState("");
  const [discountApplied, setDiscountApplied] = useState<{ code: string; amountCents: number; id: string; label: string | null } | null>(null);
  const [discountError, setDiscountError] = useState("");
  const [applyingDiscount, setApplyingDiscount] = useState(false);
  const [idPhoto, setIdPhoto] = useState<File | null>(null);
  const [idPhotoPreview, setIdPhotoPreview] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState(false);
  const [idUploaded, setIdUploaded] = useState(false);
  // Pre-flight Gemini ID check — fires immediately on successful upload and
  // is awaited at Pay-button click. Soft-fail by design: a "warn"/"rejected"
  // result shows a notice on the Consent step but never blocks checkout
  // (the authoritative server-side check still runs after payment).
  const idPrevalidatePromiseRef = useRef<Promise<{
    status: "ok" | "warn" | "rejected" | "unknown";
    reason?: string;
    name_match?: string;
  }> | null>(null);
  const [idPrevalidateResult, setIdPrevalidateResult] = useState<
    null | { status: "ok" | "warn" | "rejected" | "unknown"; reason?: string; name_match?: string }
  >(null);
  const [consentSignature, setConsentSignature] = useState<string | null>(null);
  const [consentExpanded, setConsentExpanded] = useState(false);
  // Admin override for hardware-dependency check (bypasses equipment-blocked dates).
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminOverride, setAdminOverride] = useState(false);

  // ---------------------------------------------------------------
  // PR 4a — New verification flow (Stripe Identity)
  // ---------------------------------------------------------------
  // When `useNewFlow` is true:
  //   • Email-OTP step is skipped (auth already verified on signup)
  //   • Single "VerifyStripe" step replaces ID upload (Stripe Identity hosted page)
  //   • Consent step is unchanged
  //   • Pay step calls create-booking-payment with `existingBookingId`
  // Gated by `bootstrap.isAdmin` for now (admin-only rollout) and by
  // `verification_v2_admin_only` server-side. Equipment rentals still use the
  // legacy flow because Stripe Identity is per-customer not per-rental.
  const [draftBookingId, setDraftBookingId] = useState<string | null>(
    resumeBookingId ?? null,
  );
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [startingStripeIdentity, setStartingStripeIdentity] = useState(false);
  // Sync the prop (resume entry) into state if Index changes it after open.
  useEffect(() => {
    if (resumeBookingId) setDraftBookingId(resumeBookingId);
  }, [resumeBookingId]);

  // Hydrate any saved draft for this room when the modal opens.
  // Drafts older than the TTL (30 minutes) are silently discarded by
  // readBookingDraft. If a fresh draft exists with meaningful progress, we
  // stash it and ask the user whether to continue or start over instead of
  // silently restoring potentially stale selections.
  useEffect(() => {
    if (!open || !draftKey) return;
    if (draftHydrated.current) return;
    // Resume (post-Stripe Identity): the DB booking is the source of truth. Never
    // show the "continue your previous booking?" prompt or apply the stale
    // sessionStorage draft over the resumed state — and clear the leftover draft
    // so it doesn't keep re-prompting across refreshes. (Bug 3, 2026-06-08.)
    if (resumeBookingId) {
      // Restore the PRICE INPUTS from the sessionStorage draft BEFORE clearing it,
      // so the Pay step's getTotalWithFee() (selectedTier × hours) isn't 0 on resume.
      // Regression fix for Bug 3 (e158b5d): that fix skipped the draft restore when it
      // removed the resume prompt — without these inputs the Pay step shows $0.00 and
      // the invalid-amount guard (handlePayment) blocks payment. Bug 3's prompt-
      // suppression + draft-clear below stay intact, so stale state still doesn't
      // bleed into the next booking.
      const resumeDraft = readBookingDraft<{
        date?: string; time?: string; hours?: number;
        selectedTier?: string; selectedBackdrop?: string | null;
      }>(draftKey);
      if (resumeDraft) {
        if (resumeDraft.selectedTier && !selectedTier) setSelectedTier(resumeDraft.selectedTier);
        if (typeof resumeDraft.hours === "number" && resumeDraft.hours > 0) setHours(resumeDraft.hours);
        if (resumeDraft.date && !date) {
          const parsed = parseStoredBookingDate(resumeDraft.date);
          if (parsed) setDate(parsed);
        }
        if (resumeDraft.time && !time) setTime(resumeDraft.time);
        if (resumeDraft.selectedBackdrop !== undefined && !selectedBackdrop) {
          setSelectedBackdrop(resumeDraft.selectedBackdrop);
        }
      }
      if (draftKey) clearBookingDraft(draftKey);
      pendingDraftRef.current = null;
      setResumePromptOpen(false);
      draftHydrated.current = true;
      setDraftReady(true);
      return;
    }
    const d = readBookingDraft<{
      step?: number; date?: string; time?: string; hours?: number;
      selectedTier?: string; name?: string; email?: string; phone?: string;
      termsAccepted?: boolean; idUploaded?: boolean; idPhotoPreview?: string | null;
      consentSignature?: string | null; emailVerified?: boolean;
      selectedBackdrop?: string | null; selectedLighting?: string | null;
      customRequests?: string;
    }>(draftKey);
    if (!d) {
      draftHydrated.current = true;
      setDraftReady(true);
      return;
    }
    // "Meaningful" = anything past the very first step. Otherwise just restore.
    const hasProgress =
      (typeof d.step === "number" && d.step > 0) ||
      !!d.date || !!d.time || !!d.selectedTier || !!d.consentSignature ||
      !!d.selectedBackdrop || !!d.selectedLighting || !!d.customRequests?.trim();
    if (hasProgress) {
      pendingDraftRef.current = d as Record<string, unknown>;
      setResumePromptOpen(true);
      // Defer hydration until the user chooses; don't mark ready so the
      // persist effect below doesn't immediately overwrite the draft.
      return;
    }
    applyDraft(d);
    draftHydrated.current = true;
    setDraftReady(true);
  }, [open, draftKey, resumeBookingId]);

  const applyDraft = (d: {
    step?: number; date?: string; time?: string; hours?: number;
    selectedTier?: string; name?: string; email?: string; phone?: string;
    termsAccepted?: boolean; idUploaded?: boolean; idPhotoPreview?: string | null;
    consentSignature?: string | null; emailVerified?: boolean;
    selectedBackdrop?: string | null; selectedLighting?: string | null;
    customRequests?: string;
  }) => {
    if (typeof d.step === "number") setStep(d.step);
    const parsedDraftDate = parseStoredBookingDate(d.date);
    if (parsedDraftDate) setDate(parsedDraftDate);
    if (d.time) setTime(d.time);
    if (typeof d.hours === "number") setHours(d.hours);
    if (d.selectedTier) setSelectedTier(d.selectedTier);
    if (d.name) setName(d.name);
    if (d.email) setEmail(d.email);
    if (d.phone) setPhone(d.phone);
    if (typeof d.termsAccepted === "boolean") setTermsAccepted(d.termsAccepted);
    if (typeof d.idUploaded === "boolean") setIdUploaded(d.idUploaded);
    if (d.idPhotoPreview !== undefined) setIdPhotoPreview(d.idPhotoPreview);
    if (d.consentSignature !== undefined) setConsentSignature(d.consentSignature);
    if (typeof d.emailVerified === "boolean") setEmailVerified(d.emailVerified);
    if (d.selectedBackdrop !== undefined) setSelectedBackdrop(d.selectedBackdrop);
    if (d.selectedLighting !== undefined) setSelectedLighting(d.selectedLighting);
    if (typeof d.customRequests === "string") setCustomRequests(d.customRequests);
  };

  // Reset hydration flag when modal closes so next open re-reads storage.
  useEffect(() => {
    if (!open) {
      draftHydrated.current = false;
      setDraftReady(false);
      setResumePromptOpen(false);
      pendingDraftRef.current = null;
    }
  }, [open]);

  // Persist the in-flight draft on any meaningful change. Each write refreshes
  // the lastUpdated timestamp, which keeps the 30-minute TTL sliding while the
  // user is actively making changes.
  useEffect(() => {
    if (!open || !draftKey || !draftReady) return;
    writeBookingDraft(draftKey, {
      step,
      date: date ? format(date, "yyyy-MM-dd") : null,
      time: time ?? null,
      hours,
      selectedTier: selectedTier ?? null,
      name,
      email,
      phone,
      termsAccepted,
      idUploaded,
      idPhotoPreview,
      consentSignature,
      emailVerified,
      selectedBackdrop,
      selectedLighting,
      customRequests,
    });
  }, [open, draftKey, draftReady, step, date, time, hours, selectedTier, name, email, phone, termsAccepted, idUploaded, idPhotoPreview, consentSignature, emailVerified, selectedBackdrop, selectedLighting, customRequests]);

  // Bootstrap: one round-trip for profile + admin role + loyalty + equipment
  // status — replaces 3 cascading effects (auth, profile, loyalty) with a
  // single edge-function call. Cached 30s in TanStack Query so reopening the
  // modal (or a stepper re-render) doesn't refetch.
  const queryClient = useQueryClient();
  const bootstrapEmail = email && email.includes("@") ? email.toLowerCase() : "";
  const { data: bootstrap } = useQuery({
    // Identity-keyed (see bootstrapKey): a guest's "anon" cache entry can never
    // be read by a signed-in modal. Gated on a resolved auth state so the first
    // fetch uses the right identity instead of guessing "anon" pre-hydration.
    queryKey: bootstrapKey(authUserId, email),
    enabled: open && authUserId !== undefined,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    queryFn: async () => {
      // Auth-race fix (2026-06-06): this query and the hover-prefetch can fire
      // before supabase-js has hydrated the session from localStorage, so
      // functions.invoke would send the ANON key as the Bearer → the edge fn
      // returns `user: null` → email/name never seed. The stable key + 30s
      // staleTime then block a refetch after hydration, so a refresh doesn't
      // recover (it re-races). Await getSession() so the session is loaded, then
      // attach the user token EXPLICITLY so the caller is always identified when
      // a session exists (guests stay anonymous — `undefined` → default anon).
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke(
        "get-booking-bootstrap",
        {
          body: bootstrapEmail ? { email: bootstrapEmail } : {},
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : undefined,
        },
      );
      if (error) throw error;
      return data as {
        user: {
          id: string;
          email: string | null;
          phone?: string | null;
          full_name?: string | null;
        } | null;
        profile: { display_name: string | null } | null;
        isAdmin: boolean;
        bookingCount: number;
        loyaltyTier: { tier: string; percent: number } | null;
        unavailableEquipment: Array<{
          equipment_name: string;
          is_available: boolean;
          expected_available_at: string | null;
          maintenance_note: string | null;
        }>;
      };
    },
  });

  // Apply bootstrap results — only seed user inputs once so later edits stick.
  useEffect(() => {
    if (!open || !bootstrap) return;
    if (bootstrap.user?.email && !email) setEmail(bootstrap.user.email);
    // PR 4c — Seed name from any available canonical source. The new flow
    // dropped the Email-Verify step, so there's no UI to type a name on the
    // Tier step; we must auto-fill from the authenticated session.
    if (!name) {
      const seededName =
        bootstrap.profile?.display_name?.trim() ||
        bootstrap.user?.full_name?.trim() ||
        "";
      if (seededName) setName(seededName);
    }
    // Smart prefill: restore the last phone the user typed in any prior
    // booking. Survives across rooms and across browser sessions, but never
    // overrides what they've already typed in this session.
    if (!phone) {
      if (bootstrap.user?.phone) {
        setPhone(bootstrap.user.phone);
      } else {
        try {
          const lastPhone = localStorage.getItem("rc:last-phone");
          if (lastPhone) setPhone(lastPhone);
        } catch {}
      }
    }
    setIsAdmin(bootstrap.isAdmin);
    setLoyaltyDiscount(bootstrap.loyaltyTier);
    setAuthLoaded(true);
    // We only want to seed defaults — exclude `email`/`name` from deps so the
    // user's own typing isn't reverted by a later refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bootstrap]);

  // Resolve + track the auth identity that keys the bootstrap query. getSession
  // gives the initial value (null for guests); onAuthStateChange keeps it live
  // so signing in WHILE the modal is open transitions the key (anon → user id)
  // and the query refetches with the token — the primary auth-race fix.
  // The invalidate is belt-and-suspenders for token refreshes that keep the
  // same identity (key unchanged), e.g. a silent refresh mid-session.
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (active) setAuthUserId(session?.user?.id ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setAuthUserId(session?.user?.id ?? null);
      if (event === "TOKEN_REFRESHED") {
        queryClient.invalidateQueries({ queryKey: ["booking-bootstrap"] });
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [queryClient]);

  const isEquipmentRental =
    room?.title === ROOM_EQUIPMENT_RENTAL && selectedEquipment && selectedEquipment.length > 0;

  // Lookup helpers — backdrops are billed hourly (× session hours), equipment is daily.
  const backdropPriceCentsByName = (name: string): number | null => {
    const b = BACKDROPS.find((x) => x.name === name);
    return b ? b.priceCents : null;
  };
  const isBackdrop = (name: string) => backdropPriceCentsByName(name) !== null;
  const rentalHasBackdrop = !!isEquipmentRental && selectedEquipment!.some(isBackdrop);

  // Photo packages are flat one-time fees; add-on bundles are billed per day
  // (same model as rentalPriceMap entries) so rental_days × bundlePrice works.
  const photoPackageCentsByName = (name: string): number | null => {
    const p = PHOTO_PACKAGES.find((x) => x.name === name);
    return p ? p.priceCents : null;
  };
  const addonBundleCentsByName = (name: string): number | null => {
    const b = ADDON_BUNDLES.find((x) => x.name === name);
    return b ? b.priceCents : null;
  };
  const isPhotoPackage = (name: string) => photoPackageCentsByName(name) !== null;
  const isAddonBundle = (name: string) => addonBundleCentsByName(name) !== null;

  // Slot availability — cached + auto-refetched via TanStack Query.
  // 30s staleTime matches the previous polling cadence but lets reopening
  // the modal / re-rendering reuse the cache instead of refetching.
  const slotQueryEnabled = !!date && !!room && !isEquipmentRental && open;
  const slotDateStr = date ? format(date, "yyyy-MM-dd") : "";
  const { data: densitySettings } = useBookingDensitySettings();
  const density = densitySettings ?? BOOKING_DENSITY_DEFAULTS;
  const slotQuery = useQuery({
    queryKey: ["booking-slots", density.sharedRoomPool ? "__shared__" : room?.title, slotDateStr],
    enabled: slotQueryEnabled,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchInterval: slotQueryEnabled ? 30_000 : false,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      // SHARED ROOM POOL: All 4 booking types use the same physical room.
      // When the toggle is on we query bookings across ALL room titles for the
      // date so a DJ booking blocks Podcast/Recording/Backdrop slots equally.
      const bookingsQuery = supabase
        .from("bookings")
        .select("booking_time, room_title")
        .eq("booking_date", slotDateStr)
        .in("payment_status", ["paid", "promo"]);
      if (!density.sharedRoomPool) {
        bookingsQuery.eq("room_title", room!.title);
      }
      const [bookingsRes, locksRes, dayCountRes] = await Promise.all([
        bookingsQuery,
        supabase.rpc("get_active_slot_locks"),
        supabase.rpc("get_day_booking_count", { p_booking_date: slotDateStr }),
      ]);
      return {
        booked: (bookingsRes.data || []).map((b) => b.booking_time),
        locks: ((locksRes.data || []) as Array<{
          room_title: string;
          booking_date: string;
          booking_time: string;
        }>).filter(
          (l) =>
            (density.sharedRoomPool || l.room_title === room!.title) &&
            l.booking_date === slotDateStr,
        ),
        dayCount: (dayCountRes.data as number | null) ?? 0,
      };
    },
  });

  // Project query results onto the existing state shape used throughout the
  // modal. Keeping `bookedSlots` / `lockedSlots` as state minimises downstream
  // diffs — only the source of the data changed.
  useEffect(() => {
    setSlotsLoading(slotQuery.isFetching && !slotQuery.data);
    if (!slotQuery.data) {
      if (!slotQueryEnabled) {
        setBookedSlots([]);
        setLockedSlots([]);
        setDayBookingCount(0);
        setOtherViewers(0);
      }
      return;
    }
    // Email is no longer exposed publicly; treat the slot the user currently
    // has selected as their own and exclude it from the "locked by others" set.
    const myTime = time;
    const otherLocks = slotQuery.data.locks.filter(
      (l) => l.booking_time !== myTime,
    );
    setBookedSlots(slotQuery.data.booked);
    setLockedSlots(otherLocks.map((l) => l.booking_time));
    setDayBookingCount(slotQuery.data.dayCount ?? 0);
    setOtherViewers(
      time ? otherLocks.filter((l) => l.booking_time === time).length : 0,
    );
  }, [slotQuery.data, slotQuery.isFetching, slotQueryEnabled, email, time]);

  // Default-to-soonest: when the user lands on the When step with a date but
  // no time picked, auto-select the first slot that isn't booked, locked, or
  // buffer-blocked. Reduces taps on mobile.
  useEffect(() => {
    if (!open || isEquipmentRental) return;
    if (!date || time) return;
    if (slotQuery.isFetching) return;
    const roomSlots = getTimeSlotsForRoom(room?.title);
    if (roomSlots.length === 0) return;
    const blocked = applyBufferToUnavailable(
      [...bookedSlots, ...lockedSlots],
      room?.title,
      density.bufferMinutes,
    );
    const dateStr = date ? format(date, "yyyy-MM-dd") : null;
    const equipBlockedDay =
      hasEquipDependency && !adminOverride && dateStr
        ? djUnavailableDates.has(dateStr)
        : false;
    if (equipBlockedDay) return;
    const equipBlockedSlots =
      hasEquipDependency && !adminOverride && dateStr
        ? djUnavailableTimes.get(dateStr) ?? null
        : null;
    const firstFree = roomSlots.find(
      (s) => !blocked.has(s) && !(equipBlockedSlots?.has(s)),
    );
    if (firstFree) setTime(firstFree);
    // We intentionally exclude `bookedSlots`/`lockedSlots` from deps to only
    // run on date change / data settle — the values are read fresh each pass.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, date, slotQuery.isFetching, room?.title, isEquipmentRental]);

  // Some services depend on specific equipment (admin-editable via
  // /admin/equipment-inventory; backed by service_equipment_requirements).
  // If a required item is checked out as an equipment rental (or held by
  // another customer's in-flight rental), the service must be unavailable
  // on those dates. Cached via React Query so reopening the modal reuses
  // the result instead of refetching the same date ranges every time.
  const requiredEquipment = useRequiredEquipment(room?.title);
  const { byTitle: serviceEquipMap } = useServiceEquipmentRequirements();
  // Per required item: which OTHER service titles also rely on it. These are
  // the services whose paid bookings should hour-block the slot picker.
  const otherServicesByEquipment = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const eq of requiredEquipment) {
      const usingThis: string[] = [];
      for (const [title, items] of Object.entries(serviceEquipMap)) {
        if (items.includes(eq) && title !== room?.title) usingThis.push(title);
      }
      m[eq] = usingThis;
    }
    return m;
  }, [requiredEquipment, serviceEquipMap, room?.title]);

  const hasEquipDependency = !!open && !isEquipmentRental && requiredEquipment.length > 0;
  const { data: djUnavailableData } = useQuery({
    queryKey: [
      "service-unavailable-dates",
      room?.title,
      requiredEquipment,
      otherServicesByEquipment,
    ],
    enabled: hasEquipDependency,
    staleTime: 60_000, // treat data as fresh for 1 min — no refetch on reopen
    gcTime: 5 * 60_000,
    refetchInterval: hasEquipDependency ? 60_000 : false, // keep live while modal open
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      // Whole-day blocks (multi-day rentals, gear marked unavailable, etc.)
      const dates = new Set<string>();
      // Tight-turnaround dates = the buffer days adjacent to a real rental,
      // useful for triggering admin alerts (#4) when a session lands right
      // next to a return/pickup.
      const tight = new Set<string>();
      // Hour-level blocks: date → set of HH:MM slots taken by another booking
      // that consumes the same required gear. Non-overlapping hours stay open.
      const times = new Map<string, Set<string>>();
      const addRange = (startStr: string, days: number) => {
        if (!startStr) return;
        const start = parseStoredBookingDate(startStr);
        if (!start) return;
        const buffer = EQUIPMENT_TURNAROUND_BUFFER_DAYS;
        const totalDays = Math.max(1, days) + buffer * 2;
        for (let i = -buffer; i < Math.max(1, days) + buffer; i++) {
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          const key = format(d, "yyyy-MM-dd");
          dates.add(key);
          // Mark only the buffer-edge days as "tight" (not the rental itself).
          if (i < 0 || i >= Math.max(1, days)) tight.add(key);
        }
        void totalDays;
      };
      const addTimeBlock = (dateStr: string | null, slot: string | null) => {
        if (!dateStr) return;
        if (!slot) {
          // No time info → conservative full-day block.
          dates.add(dateStr);
          return;
        }
        let set = times.get(dateStr);
        if (!set) {
          set = new Set<string>();
          times.set(dateStr, set);
        }
        set.add(slot);
      };
      // Run dependency checks per required item in parallel.
      await Promise.all(
        requiredEquipment.map(async (EQUIP) => {
          const otherServices = otherServicesByEquipment[EQUIP] ?? [];
          const queries: PromiseLike<any>[] = [
            supabase
              .from("equipment_rentals")
              .select("pickup_date, rental_days, items, created_at")
              .eq("payment_status", "paid")
              .contains("items", JSON.stringify([EQUIP])),
            supabase
              .from("equipment_locks")
              .select("equipment_name, pickup_date, rental_days, expires_at")
              .eq("equipment_name", EQUIP)
              .gt("expires_at", new Date().toISOString()),
            // Bookings with EQUIP as an explicit add-on
            supabase
              .from("bookings")
              .select("booking_date, booking_time")
              .in("payment_status", ["paid", "promo"])
              .gte("booking_date", today)
              .contains("equipment", JSON.stringify([EQUIP])),
          ];
          if (otherServices.length > 0) {
            // Bookings that implicitly use EQUIP via the
            // service_equipment_requirements mapping (e.g. another DJ session
            // requires the same CDJ even though it isn't an add-on).
            queries.push(
              supabase
                .from("bookings")
                .select("booking_date, booking_time")
                .in("payment_status", ["paid", "promo"])
                .gte("booking_date", today)
                .in("room_title", otherServices),
            );
          }
          const [rentalsRes, locksRes, explicitRes, implicitRes] = await Promise.all(queries);
          (rentalsRes.data || []).forEach((r: any) => {
            const pickup = r.pickup_date || (r.created_at ? r.created_at.slice(0, 10) : null);
            if (pickup) addRange(pickup, r.rental_days || 1);
          });
          (locksRes.data || []).forEach((l: any) => {
            if (l.pickup_date) addRange(l.pickup_date, l.rental_days || 1);
          });
          (explicitRes?.data || []).forEach((b: any) =>
            addTimeBlock(b.booking_date, b.booking_time),
          );
          (implicitRes?.data || []).forEach((b: any) =>
            addTimeBlock(b.booking_date, b.booking_time),
          );
        }),
      );
      return { dates, tight, times };
    },
  });
  const djUnavailableDates = djUnavailableData?.dates ?? EMPTY_DATE_SET;
  const djUnavailableTimes = djUnavailableData?.times ?? EMPTY_TIME_MAP;
  const djTightTurnaroundDates = djUnavailableData?.tight ?? EMPTY_DATE_SET;

  // Acquire a 10-min hold when the user reaches the Pay step (room bookings only)
  useEffect(() => {
    const isPayStep = (isEquipmentRental
      ? ["Date", "Verify", "ID", "Consent", "Pay"]
      : (room?.tiers && room.tiers.length > 0)
        ? ["When", "Tier", "Verify", "ID", "Consent", "Pay"]
        : ["When", "Verify", "ID", "Consent", "Pay"])[step] === "Pay";
    if (!isPayStep) return;
    if (isEquipmentRental || !room?.title || !date || !time || !email) return;
    if (holdLockId) return;
    // PR 4a — New flow already holds the slot via upsert_draft_booking +
    // extend_slot_lock_for_verification (30min). Skip the legacy 10-min hold.
    if (useNewFlow && draftBookingId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("acquire_slot_lock", {
        p_room_title: room.title,
        p_booking_date: format(date, "yyyy-MM-dd"),
        p_booking_time: time,
        p_email: email,
        p_ttl_seconds: 600,
      });
      if (cancelled) return;
      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row?.acquired) {
        toast.error(
          row?.conflict_reason === "already_booked"
            ? "This slot was just booked. Please pick another time."
            : "Someone else is currently checking out this slot. Please pick another time.",
        );
        setStep(1);
        return;
      }
      setHoldLockId(row.lock_id);
      setHoldExpiresAt(Date.now() + 10 * 60 * 1000);
    })();
    return () => {
      cancelled = true;
    };
  }, [step, isEquipmentRental, room, date, time, email, holdLockId]);

  // Tick the countdown every second
  useEffect(() => {
    if (!holdExpiresAt) return;
    const update = () => {
      const remaining = Math.max(0, holdExpiresAt - Date.now());
      setHoldRemainingMs(remaining);
      if (remaining <= 0) {
        setHoldLockId(null);
        setHoldExpiresAt(null);
        toast.error("Your reservation hold expired. Please pick a time again.");
        setStep(1);
      }
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [holdExpiresAt]);

  // Resend cooldown ticker — counts down to 0 then unlocks the Resend button.
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => {
      setResendIn((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  const handleJoinWaitlist = async (slot: string) => {
    if (!date || !room) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Please sign in to join the waitlist");
      return;
    }
    setJoiningWaitlist(true);
    const dateStr = format(date, "yyyy-MM-dd");
    const { error } = await supabase.from("waitlist").insert({
      user_email: session.user.email!,
      room_title: room.title,
      booking_date: dateStr,
      booking_time: slot,
    });
    if (error) {
      if (error.code === "23505") {
        toast.info("You're already on the waitlist for this slot");
      } else {
        toast.error("Failed to join waitlist");
      }
    } else {
      toast.success("Added to waitlist! We'll notify you if this slot opens up.");
    }
    setJoiningWaitlist(false);
  };

  // Equipment rental subtotal:
  //  - equipment items: $/day (flat for the rental)
  //  - backdrop items: $/hr × booking hours
  const rentalEquipmentDollars = isEquipmentRental
    ? selectedEquipment!.reduce(
        (sum, item) => {
          if (isBackdrop(item) || isPhotoPackage(item)) return sum;
          if (isAddonBundle(item)) return sum + (addonBundleCentsByName(item)! / 100);
          return sum + (rentalPriceMap[item] || 0);
        },
        0
      )
    : 0;
  const rentalBackdropCents = isEquipmentRental
    ? selectedEquipment!.reduce(
        (sum, item) => sum + (backdropPriceCentsByName(item) || 0) * hours,
        0
      )
    : 0;
  // Booking-flow backdrop is complimentary — selection is captured for the
  // studio but adds $0 to the total. (Equipment-rental backdrop add-ons are a
  // different flow and still bill via rentalBackdropCents above.)
  const customizeBackdropCents = 0;
  // Photo packages are flat (not multiplied by hours or days).
  const photoPackageCentsTotal = isEquipmentRental
    ? selectedEquipment!.reduce(
        (sum, item) => sum + (photoPackageCentsByName(item) || 0),
        0
      )
    : 0;
  const totalPerDay = rentalEquipmentDollars + Math.round(rentalBackdropCents / 100);

  const getAmountCents = (): number => {
    if (isEquipmentRental)
      return rentalEquipmentDollars * 100 + rentalBackdropCents + photoPackageCentsTotal;
    if (selectedTier) {
      return parseTierPrice(selectedTier) * hours + parseTierFlatAddOn(selectedTier) + customizeBackdropCents;
    }
    return customizeBackdropCents;
  };

  const getSubtotalAfterLoyalty = (): number => {
    const base = getAmountCents();
    if (loyaltyDiscount && loyaltyDiscount.percent > 0) {
      return Math.round(base * (1 - loyaltyDiscount.percent / 100));
    }
    return base;
  };

  const getPromoDiscountCents = (): number => {
    if (!discountApplied) return 0;
    const base = getSubtotalAfterLoyalty();
    return Math.min(discountApplied.amountCents, base);
  };

  const getGiftCardDiscount = (): number => {
    if (!giftCardApplied) return 0;
    const afterLoyalty = getSubtotalAfterLoyalty() + TRANSACTION_FEE_CENTS - getPromoDiscountCents();
    return Math.min(giftCardApplied.balanceCents, Math.max(afterLoyalty, 0));
  };

  const getTotalWithFee = (): number => {
    const afterLoyalty = getSubtotalAfterLoyalty() + TRANSACTION_FEE_CENTS;
    return Math.max(afterLoyalty - getPromoDiscountCents() - getGiftCardDiscount(), 0);
  };

  const getAmountDisplay = (): string => {
    const cents = getTotalWithFee();
    return `$${(cents / 100).toFixed(2)}`;
  };

  const handleApplyGiftCard = async () => {
    if (!giftCardCode.trim()) return;
    setApplyingGiftCard(true);
    setGiftCardError("");
    try {
      const { data: fnData, error } = await supabase.functions.invoke("validate-gift-card", {
        body: { code: giftCardCode.trim() },
      });
      const data = error ? null : fnData;
      if (!data || data.error) {
        setGiftCardError(data?.error || "Gift card not found");
        return;
      }
      if (data.payment_status !== "paid") {
        setGiftCardError("This gift card is not active");
        return;
      }
      if (data.balance_cents <= 0) {
        setGiftCardError("This gift card has no remaining balance");
        return;
      }
      if (data.redeemed_at) {
        setGiftCardError("This gift card has already been fully redeemed");
        return;
      }
      setGiftCardApplied({ code: data.code, balanceCents: data.balance_cents, id: data.id });
      toast.success(`Gift card applied! $${(data.balance_cents / 100).toFixed(2)} balance`);
    } catch {
      setGiftCardError("Failed to validate gift card");
    } finally {
      setApplyingGiftCard(false);
    }
  };

  const handleApplyDiscountCode = async () => {
    const raw = discountCodeInput.trim().toUpperCase();
    if (!raw) return;
    setApplyingDiscount(true);
    setDiscountError("");
    try {
      const { data: fnData, error } = await supabase.functions.invoke("validate-discount-code", {
        body: { code: raw },
      });
      const data = error ? null : fnData;
      if (!data || data.error) {
        setDiscountError(data?.error || "Discount code not found");
        return;
      }
      setDiscountApplied({
        code: data.code,
        amountCents: data.amount_cents,
        id: data.id,
        label: data.label || null,
      });
      toast.success(`Discount applied! -$${(data.amount_cents / 100).toFixed(2)}`);
    } catch {
      setDiscountError("Failed to validate code");
    } finally {
      setApplyingDiscount(false);
    }
  };
  const hasTiers = room?.tiers && room.tiers.length > 0 && !isEquipmentRental;

  // PR 4a: admin-gated new flow uses Stripe Identity instead of email OTP +
  // ID upload. Equipment rentals stay on legacy because Stripe Identity is
  // tied to a customer/booking, not a multi-day rental.
  // PR 6 — Public gate flipped. Stripe Identity flow is now the default for all
  // non-equipment bookings. Equipment rentals intentionally remain on legacy.
  const useNewFlow = !isEquipmentRental;

  // Customize (backdrop + lighting) is MERGED INTO the Tier step for
  // tier-having services — they share one screen, all three required to
  // advance. Tier-less services get Customize as its own step instead.
  const fullStepLabels = isEquipmentRental
    ? ["Date", "Verify", "ID", "Consent", "Pay"]
    : useNewFlow
      ? hasTiers
        ? ["When", "Tier", "VerifyStripe", "Consent", "Pay"]
        : ["When", "Customize", "VerifyStripe", "Consent", "Pay"]
      : hasTiers
        ? ["When", "Tier", "Verify", "ID", "Consent", "Pay"]
        : ["When", "Customize", "Verify", "ID", "Consent", "Pay"];
  // Inline variant: the landing page already collected date/time/tier/backdrop
  // via the inline form, so the in-page modal drops the pick steps entirely
  // and opens straight at verification — no second calendar, no second tier.
  const stepLabels =
    variant === "inline"
      ? fullStepLabels.filter(
          (l) => l !== "When" && l !== "Date" && l !== "Tier" && l !== "Customize",
        )
      : fullStepLabels;

  const getStepIndex = (logicalStep: string): number => {
    // Back-compat: legacy "Date" / "Time" both map to the merged "When" step.
    if (logicalStep === "Date" || logicalStep === "Time") {
      const whenIdx = stepLabels.indexOf("When");
      if (whenIdx !== -1) return whenIdx;
    }
    return stepLabels.indexOf(logicalStep);
  };

  const currentStepLabel = stepLabels[step] || stepLabels[0] || "";

  // When the Verify step opens on mobile, schedule a scrollIntoView so the
  // input lands above the on-screen keyboard. autoFocus alone is unreliable
  // on iPhone SE / smaller Androids when the keyboard animation outpaces
  // the browser's default focus-scroll.
  useEffect(() => {
    if (currentStepLabel !== "Verify") return;
    const t = setTimeout(() => {
      verifyInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    return () => clearTimeout(t);
  }, [currentStepLabel]);

  // Guard against stale drafts / URL history restoring a step index from a
  // different room flow. Without this, DialogContent mounts but no step body
  // matches (e.g. equipment starts on "Date", while the body only handled
  // "When"), leaving users in a dim modal with an empty body.
  useEffect(() => {
    if (!open) return;
    if (step >= 0 && step < stepLabels.length) return;
    setStep(0);
  }, [open, step, stepLabels.length]);

  // PR — URL ↔ step sync. Fire the parent's onStepChange whenever the visible
  // step label changes while the modal is open. The parent (Index) mirrors
  // the step into the URL so browser back/forward and iOS swipe-back map
  // onto our internal step nav.
  const lastReportedStepRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open) {
      lastReportedStepRef.current = null;
      return;
    }
    if (!currentStepLabel) return;
    if (lastReportedStepRef.current === currentStepLabel) return;
    lastReportedStepRef.current = currentStepLabel;
    onStepChange?.(currentStepLabel);
  }, [open, currentStepLabel, onStepChange]);

  // PR — Verification preservation on back-nav. If the user returned from
  // Stripe Identity already approved (resumeBookingId set) and then taps
  // Back from Consent into the Verify step, we render a "Verified ✓" card
  // instead of re-launching Stripe. They can tap Continue to advance again
  // without paying / re-uploading anything.
  const isVerificationApproved = !!resumeBookingId;

  // Honor `initialStep` deep-link when the modal opens, but clamp to the
  // furthest valid step for the current data so links never land on an
  // unreachable/broken state on mobile or desktop.
  // IMPORTANT: only run when the modal opens (or when `initialStep`/`room` changes).
  // Re-running on every field change (date/time/name/etc.) caused Safari to
  // fight the user's input — each keystroke re-clamped `step` back to 0 because
  // the clamp ran before draft hydration finished and before downstream state
  // settled. We intentionally exclude the data deps from the deps array.
  const clampRan = useRef(false);
  useEffect(() => { if (!open) clampRan.current = false; }, [open]);
  useEffect(() => { if (!open) cancelAutoAdvance(); }, [open]);

  // Apply inline-form prefill (date/time/tier) once when the modal opens.
  // The landing page's InlineBookingForm passes these via URL params →
  // Index.tsx → here. Skips if the modal already has values (user already
  // started picking) so we don't stomp their input.
  const prefillApplied = useRef(false);
  useEffect(() => { if (!open) prefillApplied.current = false; }, [open]);
  useEffect(() => {
    if (!open || prefillApplied.current) return;
    if (initialDate && !date) {
      const parsed = parseStoredBookingDate(initialDate);
      if (parsed) setDate(parsed);
    }
    if (initialTime && !time) {
      setTime(initialTime);
    }
    if (initialTierLabel && !selectedTier && room?.tiers?.includes(initialTierLabel)) {
      setSelectedTier(initialTierLabel);
    }
    if (initialBackdrop && !selectedBackdrop) {
      setSelectedBackdrop(initialBackdrop);
    }
    if (typeof initialHours === "number" && initialHours > 0) {
      setHours(initialHours);
    }
    // Resume: seed name/phone from the existing booking so the Consent gate
    // (needs name.trim()) passes without depending on the bootstrap query.
    if (initialName && !name) setName(initialName);
    if (initialPhone && !phone) setPhone(initialPhone);
    if (initialDate || initialTime || initialTierLabel || initialBackdrop || initialHours || initialName || initialPhone) {
      prefillApplied.current = true;
    }
  }, [open, initialDate, initialTime, initialTierLabel, initialBackdrop, initialHours, initialName, initialPhone, room?.tiers]);
  useEffect(() => {
    if (!open || !initialStep) return;
    if (clampRan.current) return;
    // Wait for draft hydration so we don't clamp before saved state lands.
    if (!draftHydrated.current) return;
    clampRan.current = true;
    // Map legacy "Date" / "Time" deep-links onto the merged "When" step.
    const normalizedInitial =
      initialStep === "Date" || initialStep === "Time" ? "When" : initialStep;
    const idx = stepLabels.indexOf(normalizedInitial);
    if (idx <= 0) {
      setStep(0);
      return;
    }

    const maxReachableStep = stepLabels.reduce((max, label, currentIndex) => {
      if (currentIndex === 0) return max;

      const previousLabel = stepLabels[currentIndex - 1];
      const previousSatisfied = (() => {
        switch (previousLabel) {
          case "When":
            return isEquipmentRental ? !!date : (!!date && !!time);
          case "Tier":
            // Tier step now requires backdrop+lighting too (merged Customize).
            // Greenscreen overrides: lighting is studio-controlled for keying,
            // so the lighting requirement is auto-satisfied for that backdrop.
            return (
              !!selectedTier &&
              !!selectedBackdrop &&
              (selectedBackdrop === "Greenscreen Backdrop" || !!selectedLighting)
            );
          case "Customize":
            // Tier-less services where Customize stayed standalone.
            return (
              !!selectedBackdrop &&
              (selectedBackdrop === "Greenscreen Backdrop" || !!selectedLighting)
            );
          case "Verify":
            return emailVerified;
          case "ID":
            return idUploaded;
          case "VerifyStripe":
            // New flow: Consent is reachable only after Stripe Identity
            // approves the booking (set on resume entry from /booking/return).
            return !!draftBookingId;
          case "Consent":
            return !!consentSignature && !!name.trim();
          case "Pay":
            return termsAccepted;
          default:
            return false;
        }
      })();

      return previousSatisfied ? currentIndex : max;
    }, 0);

    setStep(Math.min(idx, maxReachableStep));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialStep, room?.title, draftReady]);

  const handleSendCode = async () => {
    if (!email) {
      toast.error("No email found. Please sign in first.");
      return;
    }
    // Hard cap on resends per session — protects email infra from abuse and
    // gives the user a clear ceiling rather than an opaque rate-limit error.
    if (resendCount >= RESEND_MAX_PER_SESSION) {
      toast.error("Resend limit reached. Refresh to try again.");
      return;
    }
    // Optimistic UI: disable button immediately, kick off a 30s resend
    // cooldown, and flip the "code sent" view so the user can start typing
    // (or simply see acknowledgement) while the function call is in flight.
    const wasCodeSent = codeSent;
    setSending(true);
    setCodeSent(true);
    // 60s cooldown between resends per spec.
    setResendIn(60);
    setVerifyError(null);
    try {
      const { data, error } = await supabase.functions.invoke("send-verification-email", {
        body: { email },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setCodeSentAt(Date.now());
      setCodeSentSecondsAgo(0);
      setResendCount((c) => c + 1);
    } catch (err: any) {
      toast.error(err.message || "Failed to send code");
      // Roll back optimistic state on failure so the user can retry.
      setCodeSent(wasCodeSent);
      setResendIn(0);
    } finally {
      setSending(false);
    }
  };

  const handleVerifyCode = async () => {
    if (verificationCode.length !== 7) {
      setVerifyError("Enter the 7-digit code");
      return;
    }
    setVerifying(true);
    setVerifyError(null);
    try {
      const { data, error } = await supabase.functions.invoke("verify-email-code", {
        body: { email, code: verificationCode },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setEmailVerified(true);
      toast.success("Email verified!");
      setStep(step + 1);
    } catch (err: any) {
      setVerifyError(err.message || "Invalid code — check and try again.");
      setVerificationCode("");
    } finally {
      setVerifying(false);
    }
  };

  // Auto-send the 7-digit code the moment the user lands on the Verify
  // step — no manual "Send" click. Only fires once per modal session
  // (autoSentRef) and only when we have a valid email + the user hasn't
  // already been verified or sent a code.
  useEffect(() => {
    if (currentStepLabel !== "Verify") return;
    if (autoSentRef.current) return;
    if (!authLoaded) return;
    if (emailVerified || codeSent) return;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    autoSentRef.current = true;
    handleSendCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepLabel, authLoaded, email, emailVerified, codeSent]);

  // Reset auto-send latch whenever the modal closes so a fresh open
  // re-fires the send.
  useEffect(() => {
    if (!open) {
      autoSentRef.current = false;
      setResendCount(0);
      setCodeSentAt(null);
      setCodeSentSecondsAgo(0);
      setVerifyError(null);
    }
  }, [open]);

  // Tick the "Code sent X seconds ago" label.
  useEffect(() => {
    if (!codeSentAt) return;
    const tick = () => setCodeSentSecondsAgo(Math.floor((Date.now() - codeSentAt) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [codeSentAt]);

  // Auto-verify the moment 7 digits are entered — no submit click required.
  useEffect(() => {
    if (verificationCode.length !== 7) return;
    if (verifying || emailVerified) return;
    handleVerifyCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verificationCode]);

  const handlePay = async () => {
    setPaying(true);
    // Await any in-flight Gemini ID pre-check kicked off when the user
    // submitted their photo. The result is advisory — we surface a notice
    // but never block payment, since the authoritative server-side check
    // still runs after Stripe completes (`verify-id-photo`).
    if (idPrevalidatePromiseRef.current) {
      try {
        await idPrevalidatePromiseRef.current;
      } catch {
        // Swallow — the soft-fail handler already updated state.
      }
    }
    let amountCentsForReport: number | null = null;
    try {
      const amountCents = getTotalWithFee();
      amountCentsForReport = amountCents;
      if (amountCents <= 0) {
        toast.error("Invalid amount");
        setPaying(false);
        return;
      }

      // Pre-check: confirm the slot is still available before doing any
      // signature uploads or hitting Stripe. Skipped for equipment rentals
      // (no slot) and for any flow without a date+time.
      if (!isEquipmentRental && room?.title && date && time) {
        const { data: availRows, error: availErr } = await supabase.rpc(
          "check_slot_available",
          {
            p_room_title: room.title,
            p_booking_date: format(date, "yyyy-MM-dd"),
            p_booking_time: time,
            p_email: email,
          },
        );
        if (!availErr) {
          const avail = Array.isArray(availRows) ? availRows[0] : availRows;
          if (avail && avail.available === false) {
            const msg =
              avail.reason === "already_booked"
                ? "This time slot was just booked. Please pick another time."
                : "Someone else is currently booking this slot. Please pick another time.";
            toast.error(msg);
            setPaying(false);
            // Bounce back to the Time step so they can re-pick.
            const timeIdx = getStepIndex("Time");
            if (timeIdx >= 0) setStep(timeIdx);
            // Refresh the locked/booked view immediately.
            setBookedSlots((prev) => prev);
            return;
          }
        }
      }

      // Upload consent signature to private storage
      let consentSignaturePath: string | null = null;
      if (consentSignature) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const blob = dataUrlToBlob(consentSignature);
            const path = `${session.user.id}/${createUuid()}.png`;
            const { error: upErr } = await supabase.storage
              .from("consent-signatures")
              .upload(path, blob, { contentType: "image/png" });
            if (!upErr) consentSignaturePath = path;
          }
        } catch (e) {
          console.error("Signature upload failed", e);
        }
      }

      const bookingData = {
        roomTitle: room?.title,
        bookingDate: date ? format(date, "yyyy-MM-dd") : "",
        bookingTime: time || "N/A",
        customerName: name,
        customerEmail: email,
        customerPhone: phone || "Not provided",
        tier: selectedTier || null,
        equipment: selectedEquipment || [],
        // Prefer in-modal Customize-step selections over legacy sessionSelections
        // prop. Sentinel values (__none__ / __default__) are stripped to null
        // so the DB only stores real picks. Greenscreen overrides any other
        // lighting choice — studio-controlled for keying.
        lighting:
          selectedBackdrop === "Greenscreen Backdrop"
            ? "Studio-controlled (greenscreen)"
            : selectedLighting && selectedLighting !== "__default__"
              ? selectedLighting
              : sessionSelections?.lighting || null,
        backdrop:
          selectedBackdrop && selectedBackdrop !== "__none__"
            ? selectedBackdrop
            : null,
        customRequests: customRequests.trim() || null,
        sound: sessionSelections?.sound || null,
        layout: sessionSelections?.layout || null,
        amountCents,
        // hours — the server uses this to recompute the authoritative tier
        // price for studio bookings (audit #7). The client amountCents is no
        // longer trusted for Music/DJ/Podcast.
        hours,
        description: `${room?.title} — ${date ? format(date, "MMM d, yyyy") : ""} at ${time || "TBD"}${selectedTier ? ` (${selectedTier})` : ""}`,
        giftCardId: giftCardApplied?.id || null,
        giftCardCode: giftCardApplied?.code || null,
        discountCodeId: discountApplied?.id || null,
        discountCode: discountApplied?.code || null,
        idPhotoPath: idUploaded && idPhotoPreview ? idPhotoPreview : null,
        consentSignaturePath,
        consentSignerName: name,
        consentAccepted: termsAccepted,
        consentAcceptedAt: consentAcceptedAt || new Date().toISOString(),
        consentVersion: "v1.0",
        idempotencyKey: (() => {
          // Reuse a single key for the lifetime of this booking attempt.
          if (stripeIdempotencyKey) return stripeIdempotencyKey;
          const k = `bk-${createUuid()}`;
          setStripeIdempotencyKey(k);
          return k;
        })(),
        // PR 4a — New flow: tell the edge function to UPDATE the existing
        // draft row instead of INSERTing a fresh one. The function hydrates
        // missing fields (roomTitle, bookingDate, bookingTime, etc.) from the
        // row, so most of the legacy payload above is redundant on this path
        // but we keep it so promo/gift-card/loyalty/equipment logic still
        // applies untouched. Legacy path is unchanged when this is null.
        existingBookingId: useNewFlow ? draftBookingId : null,
        // Inline flow: payment-cancel returns to this landing page, not the
        // homepage modal.
        cancelPath: variant === "inline" ? window.location.pathname : null,
      };

      const { data, error } = await supabase.functions.invoke("create-booking-payment", {
        body: bookingData,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Admin alert (#4): if this booking lands on a buffer/turnaround day
      // adjacent to an equipment rental, flag it so staff can confirm gear
      // will be back & prepped in time.
      if (
        !isEquipmentRental &&
        date &&
        djTightTurnaroundDates.has(format(date, "yyyy-MM-dd"))
      ) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            await supabase.from("audit_log").insert({
              admin_user_id: session.user.id,
              action: "tight_turnaround_booking",
              entity_type: "booking",
              entity_id: data?.bookingId || null,
              details: {
                room_title: room?.title,
                booking_date: format(date, "yyyy-MM-dd"),
                customer_email: email,
                required_equipment: requiredEquipment,
                buffer_days: EQUIPMENT_TURNAROUND_BUFFER_DAYS,
                note: "Booking is within the equipment turnaround buffer of an adjacent rental. Confirm gear handoff.",
              },
            });
          }
        } catch {
          // best-effort
        }
      }

      if (data?.paidByGiftCard && data?.redirectUrl) {
        if (draftKey) clearBookingDraft(draftKey);
        try { if (phone) localStorage.setItem("rc:last-phone", phone); } catch {}
        window.location.href = data.redirectUrl;
      } else if (data?.url) {
        if (draftKey) clearBookingDraft(draftKey);
        try { if (phone) localStorage.setItem("rc:last-phone", phone); } catch {}
        // Meta Pixel: InitiateCheckout fires once just before redirect to Stripe.
        try {
          trackInitiateCheckout({
            contentName: room?.title,
            valueUsd: amountCentsForReport ? amountCentsForReport / 100 : undefined,
          });
        } catch { /* non-blocking */ }
        window.location.href = data.url;
      }
    } catch (err: any) {
      const raw = (err?.message || "").toString();
      // Map known stable error codes (and a few legacy message substrings)
      // to user-facing copy. Codes returned from create-booking-payment.
      const USER_ERROR_MAP: Record<string, string> = {
        booking_in_past: "That time has already passed — please pick a future time.",
        slot_already_booked: "That slot was just taken — please pick another time.",
        slot_locked_by_other: "Someone else is finishing checkout for this slot — please pick another time.",
        verification_required: "Your ID verification is incomplete — please verify again.",
        verification_expired: "Your ID verification has expired — please verify again.",
        booking_not_payable: "This booking is no longer payable — please start over.",
        booking_not_found: "We couldn't find your booking — please start over.",
        email_mismatch: "This booking belongs to a different email — please sign in with the correct account.",
        booking_slot_mismatch: "Your booking details changed — please pick a date and time again.",
      };
      // Some legacy callers throw human strings; route those by substring.
      let friendly = USER_ERROR_MAP[raw];
      if (!friendly) {
        if (/already booked|just booked/i.test(raw)) friendly = USER_ERROR_MAP.slot_already_booked;
        else if (/currently booking|locked/i.test(raw)) friendly = USER_ERROR_MAP.slot_locked_by_other;
        else if (/fully booked/i.test(raw)) friendly = "That day is fully booked — please pick another date.";
      }
      const isUserError = !!friendly;
      // Differentiate: user-actionable errors (slot taken, expired) get the
      // mapped copy as-is. Anything else is likely transient (network blip,
      // Stripe timeout) — tell the user it's worth a retry rather than
      // leaving them staring at a raw error message.
      if (friendly) {
        toast.error(friendly);
      } else {
        const looksTransient = /network|timeout|fetch|503|502|temporar/i.test(raw);
        toast.error(
          looksTransient
            ? "Something went wrong on our end — please try paying again in a moment."
            : raw || "Payment failed. Please try again or contact support."
        );
      }
      setPaying(false);
      // Suppress the admin "booking failed" alert for user-input errors
      // (past time, slot conflict, etc.). Reserve those for real backend
      // faults so on-call isn't paged for user mistakes.
      if (!isUserError) {
        reportBookingFailure({
          stage: "create-booking-payment",
          error: err,
          service: room?.title,
          bookingDate: date ? format(date, "yyyy-MM-dd") : null,
          bookingTime: time || null,
          customerName: name,
          customerEmail: email,
          amountCents: amountCentsForReport,
        });
      }
    }
  };

  const handleIdPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Photo must be under 10MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    setIdPhoto(file);
    setIdPhotoPreview(URL.createObjectURL(file));
  };

  const handleUploadId = async () => {
    if (!idPhoto || !email) return;
    setUploadingId(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error("Please sign in to upload your ID");
        setUploadingId(false);
        return;
      }
      const ext = idPhoto.name.split(".").pop() || "jpg";
      const path = `${session.user.id}/${createUuid()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("id-verification")
        .upload(path, idPhoto, { contentType: idPhoto.type });
      if (uploadError) throw uploadError;
      setIdUploaded(true);
      // Store the path temporarily — will be saved when booking is created
      setIdPhotoPreview(path);
      // Fire Gemini pre-check in the background. We don't await here — the
      // user proceeds to Consent immediately. The promise is consumed at Pay
      // click (see handlePay) and the latest result is mirrored to state for
      // an inline notice on the Consent step.
      const prevalidatePromise = supabase.functions
        .invoke("prevalidate-id-photo", {
          body: { idPhotoPath: path, customerName: name || email },
        })
        .then((res) => {
          const data = (res?.data ?? { status: "unknown" }) as {
            status: "ok" | "warn" | "rejected" | "unknown";
            reason?: string;
            name_match?: string;
          };
          setIdPrevalidateResult(data);
          return data;
        })
        .catch(() => {
          const fallback = { status: "unknown" as const, reason: "network" };
          setIdPrevalidateResult(fallback);
          return fallback;
        });
      idPrevalidatePromiseRef.current = prevalidatePromise;
      toast.success("ID photo uploaded successfully");
      setStep(step + 1);
    } catch (err: any) {
      toast.error(err.message || "Failed to upload ID photo");
    } finally {
      setUploadingId(false);
    }
  };

  const canProceed = (): boolean => {
    switch (currentStepLabel) {
      // Equipment rentals don't have a time picker — only require a date.
      case "Date": return !!date;
      case "When": return isEquipmentRental ? !!date : (!!date && !!time);
      case "Tier": return !!selectedTier;
      case "Verify": return emailVerified && !!name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && phone.replace(/\D/g, "").length >= 10;
      case "ID": return idUploaded;
      // VerifyStripe: the "Continue" button on this step actually triggers
      // the redirect to Stripe Identity (handled in handleNext). The user
      // only proceeds back into the modal flow on resume from /booking/return.
      // Phone is optional on the Stripe Identity path; use account phone if
      // available, otherwise allow checkout to continue without it.
      case "VerifyStripe": {
        // GUEST (Layer 2): inline account form — gate on the full signup field
        // set (email + password + name + 18+ DOB + captcha) before "Create
        // account & continue" enables.
        if (isGuest) {
          // Inline sign-in sub-step: email is already valid; need a password.
          if (loginMode) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && password.length >= 6 && !!captchaToken;
          // OTP sub-step: gate on a complete 6-digit code.
          if (awaitingOtp) return otpCode.trim().length === 6;
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
            password.length >= 6 &&
            !!name.trim() &&
            validateDob(dobYear, dobMonth, dobDay).ok &&
            !!captchaToken;
        }
        // Signed-in: mirror the handlers (createDraftBooking /
        // handleStartStripeIdentity): when an authed user's address was never
        // seeded into local state it still lives in bootstrap. .trim() guards a
        // trailing newline (JS `$` won't match before it). Without this the
        // read-only email field silently dead-locks the "Verify with Stripe" button.
        const effEmail = (email || bootstrap?.user?.email || "").trim();
        return !!name.trim() &&
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(effEmail);
      }
      case "Consent": return !!consentSignature && !!name.trim();
      case "Pay": return termsAccepted;
      default: return false;
    }
  };

  const handleNext = () => {
    if (currentStepLabel === "Pay") {
      if (!termsAccepted) return; // button stays disabled until terms accepted
      handlePay();
      return;
    }
    // PR 4a — New flow: at the end of Tier (or When for tier-less services),
    // create / re-use the draft booking row before advancing into VerifyStripe.
    if (
      useNewFlow &&
      ((currentStepLabel === "Tier" && hasTiers) ||
        (currentStepLabel === "Customize" && !hasTiers))
    ) {
      void handleCreateDraftAndAdvance();
      return;
    }
    // PR 4a — New flow: VerifyStripe → invoke create-identity-verification-session
    // then redirect to Stripe Identity hosted page.
    if (useNewFlow && currentStepLabel === "VerifyStripe") {
      // PR — If the user is already verified (returned from Stripe Identity
      // and then tapped Back from Consent), don't re-trigger the redirect.
      // Just advance the step.
      if (isVerificationApproved) {
        startStepTransition(() => {
          setStep((prev) => Math.min(prev + 1, stepLabels.length - 1));
        });
        return;
      }
      // GUEST (Layer 2): create the account first, then launch Identity. If a
      // confirmation code is pending (autoconfirm off), verify it instead.
      if (isGuest) {
        if (loginMode) { void handleInlineLoginAndStartIdentity(); return; }
        if (awaitingOtp) { void handleVerifyOtpAndStartIdentity(); return; }
        void handleGuestSignupAndStartIdentity();
        return;
      }
      void handleStartStripeIdentity();
      return;
    }
    // Mark step transitions as non-urgent — the new step's heavy markup
    // (calendar, slot grid, signature pad, etc.) renders without blocking
    // the click feedback / button ripple on slower devices.
    startStepTransition(() => {
      setStep((prev) => Math.min(prev + 1, stepLabels.length - 1));
    });
  };

  // PR 4a — Create / re-use the draft booking row at the end of Tier step.
  // This locks the slot for 30 minutes (RPC default) and gives us the
  // booking_id we need for Stripe Identity. Idempotent per slot+email.
  // Inline flow: the popup flow creates the draft booking when leaving the
  // Tier step — but the inline modal has no Tier step, so the draft is created
  // here instead, right before Stripe Identity. Returns the new booking id, or
  // null on failure. (Resume bookings already carry a draft id, so this is
  // only ever hit for a fresh inline booking — no rebook branch needed.)
  const createDraftBooking = async (): Promise<string | null> => {
    if (!room?.title || !date || !time) return null;
    const effectiveEmail = email || bootstrap?.user?.email || "";
    let effectiveName =
      name.trim() ||
      bootstrap?.profile?.display_name?.trim() ||
      bootstrap?.user?.full_name?.trim() ||
      "";
    if (!effectiveEmail) {
      toast.error("Please sign in to continue.");
      return null;
    }
    if (!effectiveName) effectiveName = effectiveEmail.split("@")[0] || "Guest";
    if (effectiveEmail !== email) setEmail(effectiveEmail);
    if (effectiveName !== name) setName(effectiveName);
    setCreatingDraft(true);
    try {
      const { data, error } = await supabase.rpc("upsert_draft_booking", {
        p_room_title: room.title,
        p_booking_date: format(date, "yyyy-MM-dd"),
        p_booking_time: time || "N/A",
        p_customer_name: effectiveName,
        p_customer_email: effectiveEmail,
        p_customer_phone: phone || "",
        p_tier: selectedTier ?? null,
        p_equipment: (selectedEquipment ?? []) as unknown as never,
        p_lighting:
          selectedBackdrop === "Greenscreen Backdrop"
            ? "Studio-controlled (greenscreen)"
            : selectedLighting && selectedLighting !== "__default__"
              ? selectedLighting
              : sessionSelections?.lighting ?? null,
        p_backdrop:
          selectedBackdrop && selectedBackdrop !== "__none__"
            ? selectedBackdrop
            : null,
        p_custom_requests: customRequests.trim() || null,
        p_sound: sessionSelections?.sound ?? null,
        p_layout: sessionSelections?.layout ?? null,
        p_amount_cents: getTotalWithFee(),
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      const newBookingId = row?.booking_id as string | undefined;
      if (!newBookingId) throw new Error("Draft booking creation returned no id");
      setDraftBookingId(newBookingId);
      return newBookingId;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start verification";
      toast.error(msg);
      reportBookingFailure({
        stage: "upsert_draft_booking",
        error: err,
        service: room?.title,
        bookingDate: date ? format(date, "yyyy-MM-dd") : null,
        bookingTime: time || null,
        customerName: effectiveName,
        customerEmail: effectiveEmail,
        amountCents: getTotalWithFee(),
      });
      return null;
    } finally {
      setCreatingDraft(false);
    }
  };

  const handleCreateDraftAndAdvance = async () => {
    if (!room?.title || !date || (!isEquipmentRental && !time)) return;
    // GUEST (Layer 2 — sub-step C): no account yet, so DON'T create the draft
    // (and its 30-min slot lock) here. Just advance to the checkout step; the
    // draft is created post-signup inside handleStartStripeIdentity. This means a
    // guest who abandons at checkout holds no slot and orphans nothing.
    if (isGuest) {
      startStepTransition(() => {
        setStep((prev) => Math.min(prev + 1, stepLabels.length - 1));
      });
      return;
    }
    // PR 4c — In the new flow there is no Email-Verify step, so name/email
    // come from the authenticated session via get-booking-bootstrap (email,
    // user_metadata.full_name) or the profiles row (display_name). If those
    // are missing we derive a safe fallback name from the email local-part
    // rather than blocking the user with a validation toast for a field that
    // isn't even rendered on this step.
    let effectiveEmail = email || bootstrap?.user?.email || "";
    let effectiveName =
      name.trim() ||
      bootstrap?.profile?.display_name?.trim() ||
      bootstrap?.user?.full_name?.trim() ||
      "";
    if (!effectiveEmail) {
      toast.error("Please sign in to continue.");
      return;
    }
    if (!effectiveName) {
      effectiveName = effectiveEmail.split("@")[0] || "Guest";
    }
    // Persist the resolved values back into state so downstream steps
    // (consent PDF, payment, confirmation email) see consistent data.
    if (effectiveEmail !== email) setEmail(effectiveEmail);
    if (effectiveName !== name) setName(effectiveName);
    setCreatingDraft(true);
    try {
      const amountCents = getTotalWithFee();
      // PR 4b — Rebook mode: a previously-verified user is picking a new
      // slot because their original was taken. Update the existing booking
      // row in place (preserving verification_status='approved' and the
      // linked id_verifications row) instead of creating a new draft.
      if (resumeBookingId) {
        const { data, error } = await supabase.rpc("rebook_existing_booking", {
          p_booking_id: resumeBookingId,
          p_room_title: room.title,
          p_booking_date: format(date, "yyyy-MM-dd"),
          p_booking_time: time || "N/A",
          p_tier: selectedTier ?? null,
          p_equipment: (selectedEquipment ?? []) as unknown as never,
          p_lighting:
            selectedBackdrop === "Greenscreen Backdrop"
              ? "Studio-controlled (greenscreen)"
              : selectedLighting && selectedLighting !== "__default__"
                ? selectedLighting
                : sessionSelections?.lighting ?? null,
          p_backdrop:
            selectedBackdrop && selectedBackdrop !== "__none__"
              ? selectedBackdrop
              : null,
          p_custom_requests: customRequests.trim() || null,
          p_sound: sessionSelections?.sound ?? null,
          p_layout: sessionSelections?.layout ?? null,
          p_amount_cents: amountCents,
        });
        if (error) {
          const msg = error.message || "";
          if (msg.includes("slot_already_booked")) {
            toast.error("That slot was just booked. Please pick another time.");
          } else if (msg.includes("slot_locked_by_other")) {
            toast.error("Someone else is currently checking out that slot. Please pick another time.");
          } else {
            toast.error(msg || "Could not reserve that slot. Please try again.");
          }
          return;
        }
        setDraftBookingId(resumeBookingId);
        // Skip VerifyStripe — the user is already approved. Jump to Consent.
        const consentIdx = getStepIndex("Consent");
        startStepTransition(() => {
          if (consentIdx >= 0) setStep(consentIdx);
          else setStep((prev) => Math.min(prev + 1, stepLabels.length - 1));
        });
        return;
      }
      const { data, error } = await supabase.rpc("upsert_draft_booking", {
        p_room_title: room.title,
        p_booking_date: format(date, "yyyy-MM-dd"),
        p_booking_time: time || "N/A",
        p_customer_name: effectiveName,
        p_customer_email: effectiveEmail,
        p_customer_phone: phone || "",
        p_tier: selectedTier ?? null,
        p_equipment: (selectedEquipment ?? []) as unknown as never,
        p_lighting:
          selectedBackdrop === "Greenscreen Backdrop"
            ? "Studio-controlled (greenscreen)"
            : selectedLighting && selectedLighting !== "__default__"
              ? selectedLighting
              : sessionSelections?.lighting ?? null,
        p_backdrop:
          selectedBackdrop && selectedBackdrop !== "__none__"
            ? selectedBackdrop
            : null,
        p_custom_requests: customRequests.trim() || null,
        p_sound: sessionSelections?.sound ?? null,
        p_layout: sessionSelections?.layout ?? null,
        p_amount_cents: amountCents,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      const newBookingId = row?.booking_id as string | undefined;
      if (!newBookingId) {
        throw new Error("Draft booking creation returned no id");
      }
      setDraftBookingId(newBookingId);
      startStepTransition(() => {
        setStep((prev) => Math.min(prev + 1, stepLabels.length - 1));
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start verification";
      toast.error(msg);
      reportBookingFailure({
        stage: "upsert_draft_booking",
        error: err,
        service: room?.title,
        bookingDate: date ? format(date, "yyyy-MM-dd") : null,
        bookingTime: time || null,
        customerName: effectiveName,
        customerEmail: effectiveEmail,
        amountCents: getTotalWithFee(),
      });
    } finally {
      setCreatingDraft(false);
    }
  };

  // PR 4a — VerifyStripe step: invoke create-identity-verification-session
  // and redirect the browser to the Stripe-hosted document capture page.
  // The session_id metadata.booking_id ties the result back via webhook.
  const handleStartStripeIdentity = async () => {
    let bookingId = draftBookingId;
    if (!bookingId) {
      // Inline flow: no Tier step ran, so no draft exists yet — create it now.
      bookingId = await createDraftBooking();
    }
    if (!bookingId) {
      toast.error("Booking draft missing. Please go back and try again.");
      return;
    }
    setStartingStripeIdentity(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "create-identity-verification-session",
        {
          body: {
            booking_id: bookingId,
            // Inline flow: tell Stripe to return the user to this landing
            // page, not the homepage modal.
            ...(variant === "inline"
              ? { return_path: window.location.pathname }
              : {}),
          },
        },
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.already_verified) {
        // Skip Stripe redirect; jump straight into Consent.
        toast.success("ID already verified — continuing to checkout.");
        const consentIdx = getStepIndex("Consent");
        if (consentIdx >= 0) setStep(consentIdx);
        return;
      }
      if (!data?.url) throw new Error("No verification URL returned");
      window.location.href = data.url as string;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start verification";
      toast.error(msg);
    } finally {
      setStartingStripeIdentity(false);
    }
  };

  // GUEST (Layer 2 Chunk 2b): create the account inline at checkout, then launch
  // Stripe Identity. B2 wires the autoconfirm-on happy path (signUp -> session ->
  // Identity). The OTP sub-step (needs_otp) and inline login (email_exists) land
  // in the next checkpoints (B3/B4) — placeholder toasts until then.
  const handleGuestSignupAndStartIdentity = async () => {
    const dob = validateDob(dobYear, dobMonth, dobDay);
    if (!dob.ok) {
      toast.error("Please enter a valid date of birth — you must be 18 or older.");
      return;
    }
    const result = await inlineSignup.signUp({
      email: email.trim(),
      password,
      displayName: name.trim(),
      dobIso: dob.iso,
      captchaToken: captchaToken ?? "",
    });
    if (result.status === "session") {
      // Autoconfirm-on: account created + signed in. handleStartStripeIdentity
      // creates the draft (now authed) and redirects to Stripe Identity.
      await handleStartStripeIdentity();
      return;
    }
    if (result.status === "needs_otp") {
      // Confirmation required (autoconfirm off): switch to the inline 6-digit
      // code sub-step. The account exists but is unconfirmed and NO draft/slot
      // was created yet, so there's nothing to clean up if they abandon.
      setAwaitingOtp(true);
      return;
    }
    if (result.status === "email_exists") {
      // Existing account — switch to inline sign-in (email stays prefilled).
      setLoginMode(true);
      return;
    }
    // signUp failed — the captcha token was consumed; reset it for a clean retry.
    guestCaptchaRef.current?.resetCaptcha();
    setCaptchaToken(null);
    toast.error(result.message || "Could not create your account. Please try again.");
  };

  // GUEST inline sign-in sub-step: existing account → sign in → launch Identity.
  const handleInlineLoginAndStartIdentity = async () => {
    const result = await inlineSignup.signIn({ email: email.trim(), password, captchaToken: captchaToken ?? "" });
    if (result.status === "session") {
      setLoginMode(false);
      await handleStartStripeIdentity();
      return;
    }
    // Failed login consumed the single-use captcha token — reset for a retry.
    guestCaptchaRef.current?.resetCaptcha();
    setCaptchaToken(null);
    toast.error(result.message || "Could not sign in. Please check your password.");
  };

  // GUEST OTP sub-step: verify the 6-digit code → mint session → launch Identity.
  const handleVerifyOtpAndStartIdentity = async () => {
    const result = await inlineSignup.verifyOtp({
      email: email.trim(),
      token: otpCode.trim(),
      displayName: name.trim(),
    });
    if (result.status === "session") {
      setAwaitingOtp(false);
      await handleStartStripeIdentity();
      return;
    }
    toast.error(result.message || "That code didn't work — check it and try again.");
  };

  const handleResendOtp = async () => {
    const r = await inlineSignup.resendOtp({ email: email.trim() });
    toast(r.ok ? "We sent a new code to your email." : (r.message || "Could not resend the code."));
  };

  const handleReset = () => {
    setStep(0);
    setDate(undefined);
    setTime(undefined);
    setHours(2);
    setSelectedTier(undefined);
    setSelectedBackdrop(null);
    setSelectedLighting(null);
    setCustomRequests("");
    setVerificationCode("");
    setEmailVerified(false);
    setCodeSent(false);
    setAwaitingOtp(false);
    setOtpCode("");
    setLoginMode(false);
    setTermsAccepted(false);
    setTermsExpanded(false);
    setConsentAcceptedAt(null);
    setAuthLoaded(false);
    setGiftCardCode("");
    setGiftCardApplied(null);
    setGiftCardError("");
    setDiscountCodeInput("");
    setDiscountApplied(null);
    setDiscountError("");
    setIdPhoto(null);
    setIdPhotoPreview(null);
    setIdUploaded(false);
    setConsentSignature(null);
    setConsentExpanded(false);
    setStripeIdempotencyKey(null);
    setOtherViewers(0);
    // Release any active hold when the modal resets
    if (holdLockId) {
      supabase.rpc("release_slot_lock", { p_lock_id: holdLockId }).then(() => {});
    }
    setHoldLockId(null);
    setHoldExpiresAt(null);
    setHoldRemainingMs(0);
    if (draftKey) clearBookingDraft(draftKey);
  };

  return (
    <>
    <AlertDialog open={resumePromptOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Continue your previous booking?</AlertDialogTitle>
          <AlertDialogDescription>
            We saved your selections from earlier. You can pick up where you left off,
            or start a fresh booking.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => {
              pendingDraftRef.current = null;
              setResumePromptOpen(false);
              if (draftKey) clearBookingDraft(draftKey);
              handleReset();
              draftHydrated.current = true;
              setDraftReady(true);
            }}
          >
            Start over
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              const d = pendingDraftRef.current as Parameters<typeof applyDraft>[0] | null;
              if (d) applyDraft(d);
              pendingDraftRef.current = null;
              setResumePromptOpen(false);
              draftHydrated.current = true;
              setDraftReady(true);
            }}
          >
            Continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <BookingFlowShell
      variant={variant}
      open={open}
      room={room}
      email={email}
      requiredEquipment={requiredEquipment}
      isEquipmentRental={isEquipmentRental}
      onDialogOpenChange={(o) => {
        // Closing the modal preserves the draft so deep-linking / reopening
        // restores Date/Time/Tier/etc. Only release the active slot hold; the
        // draft is cleared on successful payment or via explicit reset.
        if (!o && holdLockId) {
          supabase.rpc("release_slot_lock", { p_lock_id: holdLockId }).then(() => {});
          setHoldLockId(null);
          setHoldExpiresAt(null);
          setHoldRemainingMs(0);
        }
        onOpenChange(o);
      }}
    >

        {/* Draft notice — shown whenever the user has unsaved booking
            selections so the 30-min auto-clear doesn't surprise them. */}
        {draftReady && (date || time || selectedTier) && (
          <p className="text-[10px] font-body text-muted-foreground/80 inline-flex items-center gap-1.5 -mt-1">
            <Clock className="w-2.5 h-2.5" />
            Your selections are saved for the next 30 minutes.
          </p>
        )}

        {/* Selected equipment summary */}
        {isEquipmentRental && (
          <div className="rounded-md border border-border bg-secondary/50 p-3 space-y-1.5 mb-1">
            <p className="text-[10px] font-display font-semibold uppercase tracking-[0.15em] text-foreground">Selected Gear</p>
            {selectedEquipment!.map((item) => {
              const bdCents = backdropPriceCentsByName(item);
              if (bdCents !== null) {
                const lineCents = bdCents * hours;
                return (
                  <div key={item} className="flex justify-between items-center">
                    <span className="text-xs font-body text-muted-foreground">
                      {item} <span className="text-[10px] text-muted-foreground/70">${(bdCents / 100).toFixed(0)}/hr × {hours}h</span>
                    </span>
                    <span className="text-xs font-display font-semibold text-foreground">${(lineCents / 100).toFixed(2)}</span>
                  </div>
                );
              }
              const pkgCents = photoPackageCentsByName(item);
              if (pkgCents !== null) {
                return (
                  <div key={item} className="flex justify-between items-center">
                    <span className="text-xs font-body text-muted-foreground">
                      {item} <span className="text-[10px] text-muted-foreground/70">flat fee</span>
                    </span>
                    <span className="text-xs font-display font-semibold text-foreground">${(pkgCents / 100).toFixed(2)}</span>
                  </div>
                );
              }
              const bundleCents = addonBundleCentsByName(item);
              if (bundleCents !== null) {
                return (
                  <div key={item} className="flex justify-between items-center">
                    <span className="text-xs font-body text-muted-foreground">{item}</span>
                    <span className="text-xs font-display font-semibold text-foreground">${(bundleCents / 100).toFixed(0)}/day</span>
                  </div>
                );
              }
              return (
                <div key={item} className="flex justify-between items-center">
                  <span className="text-xs font-body text-muted-foreground">{item}</span>
                  <span className="text-xs font-display font-semibold text-foreground">${rentalPriceMap[item] || 0}/day</span>
                </div>
              );
            })}
            <div className="border-t border-border pt-1.5 mt-1.5 flex justify-between items-center">
              <span className="text-xs font-display font-semibold text-foreground">Total</span>
              <span className="text-sm font-display font-bold chrome-text">${(getAmountCents() / 100).toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Step indicators */}
        <div className="flex gap-2 mb-4">
          {stepLabels.map((label, i) => (
            <div key={label} className="flex-1">
              <div className={cn(
                "h-px transition-colors",
                i <= step ? "bg-chrome" : "bg-border"
              )} />
              <p className={cn(
                "text-[9px] uppercase tracking-[0.12em] mt-2 font-body",
                i <= step ? "text-foreground" : "text-muted-foreground"
              )}>{
                label === "When"
                  ? (isEquipmentRental ? "Date" : "Date & Time")
                  : label === "VerifyStripe"
                    ? "Verify ID"
                    : label
              }</p>
            </div>
          ))}
        </div>

        {/* Running price preview — visible once the user has picked enough
            to have a real number. Eliminates the "$0 until checkout" surprise. */}
        {currentStepLabel !== "Pay" && getTotalWithFee() > 0 && (
          <div className="flex items-center justify-between gap-2 mb-3 px-3 py-1.5 rounded-md border border-border/50 bg-secondary/30 text-[10px] font-body">
            <span className="uppercase tracking-wider text-muted-foreground">Estimated total</span>
            <span className="font-display font-bold chrome-text text-sm">{getAmountDisplay()}</span>
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* DATE + TIME (merged) */}
          {(currentStepLabel === "When" || currentStepLabel === "Date") && (
            <motion.div key={currentStepLabel === "Date" ? "date" : "when"} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.15 }} className="space-y-3">
              <div className="flex justify-center w-full">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(nextDate) => {
                  cancelAutoAdvance();
                  setDate(nextDate);
                  if (nextDate) setTime(undefined);
                }}
                disabled={(d) => {
                  if (d < getTodayAtLocalMidnight()) return true;
                  // Admin-configurable lookahead window.
                  const max = new Date(getTodayAtLocalMidnight());
                  max.setDate(max.getDate() + Math.max(0, lookaheadDays));
                  if (d > max) return true;
                  if (
                    hasEquipDependency &&
                    !adminOverride &&
                    djUnavailableDates.has(format(d, "yyyy-MM-dd"))
                  ) {
                    return true;
                  }
                  return false;
                }}
                className="p-3 pointer-events-auto mx-auto"
                classNames={{
                  head_cell:
                    "text-zinc-300 rounded-md w-9 font-medium text-[0.8rem] uppercase tracking-wider",
                  caption_label: "text-sm font-medium text-zinc-100",
                  day: cn(
                    "h-9 w-9 p-0 font-medium rounded-md inline-flex items-center justify-center text-zinc-100 transition-colors hover:bg-zinc-800 hover:text-white aria-selected:opacity-100",
                  ),
                  day_selected:
                    "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground ring-1 ring-zinc-300",
                  day_today: "bg-zinc-800 text-white ring-1 ring-zinc-500",
                  day_outside: "text-zinc-600 opacity-100",
                  day_disabled: "text-zinc-600 opacity-60 hover:bg-transparent hover:text-zinc-600 cursor-not-allowed",
                }}
              />
              </div>
              {hasEquipDependency && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] font-body text-muted-foreground justify-center">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border border-emerald-300/60" />
                      <span className="text-zinc-200">Available</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-amber-300/60" />
                      <span className="text-zinc-200">Equipment in use</span>
                    </span>
                  </div>
                  {date && djUnavailableDates.has(format(date, "yyyy-MM-dd")) && !adminOverride && (
                    <button
                      type="button"
                      onClick={() => {
                        // Log analytics: user wanted a date blocked by the dependency (#6)
                        requiredEquipment.forEach((eq) =>
                          logEquipmentBlockEvent({
                            supabase,
                            equipmentName: eq,
                            service: room?.title || "",
                            blockDirection: "service_blocked_by_rental",
                            blockedDate: format(date, "yyyy-MM-dd"),
                            userEmail: email || null,
                          }),
                        );
                        handleJoinWaitlist("10:00 AM");
                      }}
                      disabled={joiningWaitlist || !email}
                      className="w-full text-[11px] font-body text-primary hover:text-primary/80 underline underline-offset-2 transition-colors disabled:opacity-50"
                    >
                      <Bell className="w-3 h-3 inline mr-1" />
                      Notify me if {room?.title} opens up on {format(date, "MMM d")}
                    </button>
                  )}
                  {isAdmin && (
                    <label className="flex items-center gap-2 text-[10px] font-body text-muted-foreground/80 justify-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={adminOverride}
                        onChange={(e) => setAdminOverride(e.target.checked)}
                        className="accent-primary w-3 h-3"
                      />
                      Admin override (bypass equipment check)
                    </label>
                  )}
                </div>
              )}
              {rentalHasBackdrop && (
                <div>
                  <label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-body block mb-2">
                    Backdrop Duration (hours)
                  </label>
                  <div className="flex gap-2">
                    {[2, 3, 4, 5, 6].map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setHours(h)}
                        className={cn(
                          "flex-1 py-2 rounded-md text-xs font-body transition-all border",
                          hours === h ? "chrome-btn border-transparent" : "chrome-btn-outline"
                        )}
                      >
                        {h}h
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground/70 font-body mt-2">
                    Backdrops are billed hourly. Other gear is flat per-day.
                  </p>
                </div>
              )}
              {/* Inline time picker — appears once a date is chosen.
                  Equipment rentals skip this entirely (no time selection). */}
              {!isEquipmentRental && date && (
                <div className="space-y-4 pt-2 border-t border-border/40">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-body">
                    Pick a time on {format(date, "EEE, MMM d")}
                  </p>
                  {slotQuery.isError && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-xs font-body text-foreground">
                      <p className="font-semibold mb-1">Couldn't load available times.</p>
                      <p className="text-muted-foreground">
                        Check your connection and{" "}
                        <button
                          type="button"
                          onClick={() => slotQuery.refetch()}
                          className="underline text-foreground hover:text-primary transition-colors"
                        >
                          try again
                        </button>
                        , or email{" "}
                        <a href="mailto:replayclubrecords@gmail.com" className="underline text-foreground hover:text-primary transition-colors">
                          replayclubrecords@gmail.com
                        </a>
                        .
                      </p>
                    </div>
                  )}
                  {!adminOverride &&
                    density.dailyCap > 0 &&
                    dayBookingCount >= density.dailyCap && (
                      <div className="rounded-md border border-border/60 bg-muted/40 px-3 py-2.5 text-xs font-body text-muted-foreground text-center">
                        Fully booked — try another date.
                      </div>
                    )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" aria-busy={slotsLoading}>
                {(() => {
                  const roomSlots = getTimeSlotsForRoom(room?.title);
                  // 30-min same-room buffer: a slot starting right after a
                  // booked/locked one is also unavailable. See bookingTimeSlots.ts.
                  const bufferedBlocked = applyBufferToUnavailable(
                    [...bookedSlots, ...lockedSlots],
                    room?.title,
                    density.bufferMinutes,
                  );
                  // Daily session cap (cross-type when shared room pool is on).
                  // Admin override bypasses the cap.
                  const isDayFull =
                    !adminOverride &&
                    density.dailyCap > 0 &&
                    dayBookingCount >= density.dailyCap;
                  // Real-time "too soon" gating: admin-configurable lead time
                  // (default 120 min). Earliest bookable = now + leadMinutes,
                  // rounded UP to a full hour. Re-evaluated every 60s via `nowTick`.
                  const now = new Date(nowTick);
                  const isToday = !!date &&
                    format(date, "yyyy-MM-dd") === format(now, "yyyy-MM-dd");
                  const earliestMs = now.getTime() + leadMinutes * 60_000;
                  const earliest = new Date(earliestMs);
                  const earliestStartMinutes = isToday
                    ? earliest.getMinutes() === 0 && earliest.getSeconds() === 0
                      ? earliest.getHours() * 60
                      : (earliest.getHours() + 1) * 60
                    : -1;
                  const slotToMin = (s: string): number => {
                    const m = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
                    if (!m) return -1;
                    let h = parseInt(m[1], 10) % 12;
                    if (m[3].toUpperCase() === "PM") h += 12;
                    return h * 60 + parseInt(m[2], 10);
                  };
                  if (slotsLoading && bookedSlots.length === 0 && lockedSlots.length === 0) {
                    return roomSlots.map((slot) => (
                      <div
                        key={`skeleton-${slot}`}
                        className="w-full py-2.5 px-3 rounded-md border border-border/40 bg-muted/30 animate-pulse h-[34px]"
                        aria-hidden="true"
                      />
                    ));
                  }
                  return roomSlots.map((slot) => {
                  const isBooked = bookedSlots.includes(slot);
                  const isLocked = !isBooked && lockedSlots.includes(slot);
                  const isBufferBlocked =
                    !isBooked && !isLocked && bufferedBlocked.has(slot);
                  const dateStr = date ? format(date, "yyyy-MM-dd") : null;
                  const isEquipDayBlocked =
                    hasEquipDependency && !adminOverride && dateStr
                      ? djUnavailableDates.has(dateStr)
                      : false;
                  const isEquipTimeBlocked =
                    hasEquipDependency && !adminOverride && dateStr && !isEquipDayBlocked
                      ? djUnavailableTimes.get(dateStr)?.has(slot) ?? false
                      : false;
                  const isTooSoon = isToday && slotToMin(slot) < earliestStartMinutes;
                  const isUnavailable =
                    isBooked || isLocked || isBufferBlocked || isEquipDayBlocked || isEquipTimeBlocked || isTooSoon || isDayFull;
                  return (
                    <div key={slot} className="relative">
                      <button
                        onClick={() => {
                          if (isUnavailable) return;
                          // Optimistic select + 600ms auto-advance with undo toast.
                          cancelAutoAdvance();
                          const previousTime = time;
                          setTime(slot);
                          autoAdvanceTimerRef.current = setTimeout(() => {
                            startStepTransition(() => {
                              setStep((prev) => Math.min(prev + 1, stepLabels.length - 1));
                            });
                            toast("Moving on…", {
                              duration: 3000,
                              action: {
                                label: "Undo",
                                onClick: () => {
                                  cancelAutoAdvance();
                                  setTime(previousTime);
                                  setStep(getStepIndex("When"));
                                },
                              },
                            });
                          }, 600);
                        }}
                        disabled={isUnavailable}
                        title={
                          isDayFull
                            ? "Fully booked — try another date"
                            : isLocked
                              ? "Someone is currently booking this slot"
                              : isBooked
                                ? "Booked"
                                : isBufferBlocked
                                  ? "Reserved"
                                  : isEquipTimeBlocked
                                    ? "Required gear is in use this hour"
                                    : isTooSoon
                                      ? "Too close to now — pick a later time"
                                      : undefined
                        }
                        className={cn(
                          "w-full py-2.5 px-3 rounded-md text-xs font-body transition-all border",
                          isUnavailable
                            ? "border-border/50 text-muted-foreground/50 cursor-not-allowed bg-muted/30 line-through"
                            : time === slot
                              ? "chrome-btn border-transparent"
                              : "chrome-btn-outline"
                        )}
                      >
                        {slot}
                      </button>
                      {isUnavailable && !isTooSoon && (
                        <button
                          onClick={() => handleJoinWaitlist(slot)}
                          disabled={joiningWaitlist}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center hover:bg-primary/80 transition-colors"
                          title={isLocked ? "Someone is currently booking — join waitlist" : "Join waitlist for this slot"}
                        >
                          <Bell className="w-2.5 h-2.5 text-primary-foreground" />
                        </button>
                      )}
                    </div>
                  );
                });
                })()}
                  </div>
                  <div>
                <label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-body block mb-2">
                  Duration (hours)
                </label>
                <div className="flex gap-2">
                  {(room?.minHours === 1 ? [1, 2, 3, 4, 5, 6] : [2, 3, 4, 5, 6]).map((h) => (
                    <button
                      key={h}
                      onClick={() => setHours(h)}
                      className={cn(
                        "flex-1 py-2 rounded-md text-xs font-body transition-all border",
                        hours === h ? "chrome-btn border-transparent" : "chrome-btn-outline"
                      )}
                    >
                      {h}h
                    </button>
                  ))}
                </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* TIER — now also hosts Customize (backdrop + lighting). All three
              sections required to advance from this step. Standalone Customize
              step still exists for tier-less services. */}
          {currentStepLabel === "Tier" && room?.tiers && (
            <motion.div key="tier" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.15 }} className="space-y-5">
              {/* Package / Tier */}
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-body">Select your package</p>
                {room.tiers.map((tier) => {
                  const features = tierFeatures?.[tier];
                  const isSelected = selectedTier === tier;
                  return (
                    <div key={tier} className="space-y-1.5">
                      <button
                        onClick={() => setSelectedTier(tier)}
                        className={cn(
                          "w-full p-3 rounded-md text-left text-xs font-body transition-all border",
                          isSelected ? "chrome-btn border-transparent" : "chrome-btn-outline"
                        )}
                      >
                        {tier}
                      </button>
                      {/* Features dropdown — admin-edited at /admin/services,
                          shown beneath the selected tier as a bullet list. */}
                      {isSelected && features && features.length > 0 && (
                        <motion.ul
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.15 }}
                          className="ml-2 pl-3 border-l border-border/40 space-y-1 overflow-hidden"
                        >
                          {features.map((f, i) => (
                            <li
                              key={i}
                              className="text-[11px] font-body text-muted-foreground leading-snug flex items-start gap-1.5"
                            >
                              <Check className="w-2.5 h-2.5 mt-0.5 shrink-0 text-primary" />
                              <span>{f}</span>
                            </li>
                          ))}
                        </motion.ul>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Backdrop */}
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-body">Backdrop</p>
                <div className="grid grid-cols-2 gap-2">
                  {effectiveBackdrops.map((b, i) => (
                    <button
                      key={b.name}
                      onClick={() => setSelectedBackdrop(b.name)}
                      className={cn(
                        "p-2 rounded-md text-left text-xs font-body transition-all border",
                        selectedBackdrop === b.name ? "chrome-btn border-transparent" : "chrome-btn-outline"
                      )}
                    >
                      <div className="relative w-full aspect-[4/3] rounded overflow-hidden bg-muted">
                        <img
                          src={b.image}
                          alt={b.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label={`Preview ${b.name} larger`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setBackdropPreviewIndex(i);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              setBackdropPreviewIndex(i);
                            }
                          }}
                          className="absolute top-1 right-1 bg-background/80 hover:bg-background rounded p-1 cursor-pointer transition-colors"
                        >
                          <Maximize2 className="w-3 h-3" />
                        </span>
                      </div>
                      <div className="font-display font-semibold mt-2 text-center">{b.name.replace(/ Backdrop$/, "")}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Lighting — hidden for greenscreen since lighting is
                  studio-controlled for chroma-key. Show a note instead. */}
              {selectedBackdrop === "Greenscreen Backdrop" ? (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-body">Lighting</p>
                  <div className="rounded-md border border-dashed border-border p-3 text-[11px] font-body text-muted-foreground">
                    Studio-controlled — greenscreen requires specific flat
                    lighting for clean keying, handled by our team.
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-body">Lighting</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setSelectedLighting("__default__")}
                      className={cn(
                        "p-3 rounded-md text-left text-xs font-body transition-all border min-h-[64px]",
                        selectedLighting === "__default__" ? "chrome-btn border-transparent" : "chrome-btn-outline"
                      )}
                    >
                      <div className="font-display font-semibold">Default</div>
                      <div className="text-[10px] opacity-70 mt-0.5">Studio picks for you</div>
                    </button>
                    {lightingOptions.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setSelectedLighting(opt.label)}
                        className={cn(
                          "p-3 rounded-md text-left text-xs font-body transition-all border min-h-[64px]",
                          selectedLighting === opt.label ? "chrome-btn border-transparent" : "chrome-btn-outline"
                        )}
                      >
                        <div className="font-display font-semibold">{opt.label}</div>
                        <div className="text-[10px] opacity-70 mt-0.5">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Special requests — free text for client to add notes the
                  studio should see (specific gear, lighting tweaks, vibe
                  references, etc.). Visible to admin on the booking record. */}
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-body">Any other requests?</p>
                <textarea
                  value={customRequests}
                  onChange={(e) => setCustomRequests(e.target.value.slice(0, 500))}
                  placeholder="Optional — anything special you'd like for your session"
                  rows={3}
                  className="w-full p-3 rounded-md text-xs font-body bg-background border border-input focus:border-foreground focus:outline-none resize-none"
                />
                <p className="text-[9px] text-muted-foreground text-right">{customRequests.length}/500</p>
              </div>

              {selectedTier && (
                <p className="text-sm font-display font-bold chrome-text text-center pt-2">
                  {hours}h × {selectedTier.split("—")[0].trim()}
                  {parseTierFlatAddOn(selectedTier) > 0 && ` + $${(parseTierFlatAddOn(selectedTier) / 100).toFixed(0)} flat`}
                  {" = "}{getAmountDisplay()}
                </p>
              )}
            </motion.div>
          )}

          {/* CUSTOMIZE — Backdrop + Lighting (added 2026-05-11). Both required
              to advance (see maxReachableStep). Explicit "None" / "Default"
              tiles let users opt out while still satisfying the gate. */}
          {currentStepLabel === "Customize" && (
            <motion.div
              key="customize"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.15 }}
              className="space-y-5"
            >
              {/* Backdrop picker */}
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-body">
                  Backdrop
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {effectiveBackdrops.map((b, i) => (
                    <button
                      key={b.name}
                      onClick={() => setSelectedBackdrop(b.name)}
                      className={cn(
                        "p-2 rounded-md text-left text-xs font-body transition-all border",
                        selectedBackdrop === b.name ? "chrome-btn border-transparent" : "chrome-btn-outline"
                      )}
                    >
                      <div className="relative w-full aspect-[4/3] rounded overflow-hidden bg-muted">
                        <img
                          src={b.image}
                          alt={b.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label={`Preview ${b.name} larger`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setBackdropPreviewIndex(i);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              setBackdropPreviewIndex(i);
                            }
                          }}
                          className="absolute top-1 right-1 bg-background/80 hover:bg-background rounded p-1 cursor-pointer transition-colors"
                        >
                          <Maximize2 className="w-3 h-3" />
                        </span>
                      </div>
                      <div className="font-display font-semibold mt-2 text-center">{b.name.replace(/ Backdrop$/, "")}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Lighting picker — hidden for greenscreen since lighting is
                  studio-controlled for chroma-key. */}
              {selectedBackdrop === "Greenscreen Backdrop" ? (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-body">
                    Lighting
                  </p>
                  <div className="rounded-md border border-dashed border-border p-3 text-[11px] font-body text-muted-foreground">
                    Studio-controlled — greenscreen requires specific flat
                    lighting for clean keying, handled by our team.
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-body">
                    Lighting
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setSelectedLighting("__default__")}
                      className={cn(
                        "p-3 rounded-md text-left text-xs font-body transition-all border min-h-[64px]",
                        selectedLighting === "__default__" ? "chrome-btn border-transparent" : "chrome-btn-outline"
                      )}
                    >
                      <div className="font-display font-semibold">Default</div>
                      <div className="text-[10px] opacity-70 mt-0.5">Studio picks for you</div>
                    </button>
                    {lightingOptions.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setSelectedLighting(opt.label)}
                        className={cn(
                          "p-3 rounded-md text-left text-xs font-body transition-all border min-h-[64px]",
                          selectedLighting === opt.label ? "chrome-btn border-transparent" : "chrome-btn-outline"
                        )}
                      >
                        <div className="font-display font-semibold">{opt.label}</div>
                        <div className="text-[10px] opacity-70 mt-0.5">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Special requests — free text for client to flag special asks
                  (gear, vibe references, accessibility notes). Visible to
                  admin on the booking record. */}
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-body">Any other requests?</p>
                <textarea
                  value={customRequests}
                  onChange={(e) => setCustomRequests(e.target.value.slice(0, 500))}
                  placeholder="Optional — anything special you'd like for your session"
                  rows={3}
                  className="w-full p-3 rounded-md text-xs font-body bg-background border border-input focus:border-foreground focus:outline-none resize-none"
                />
                <p className="text-[9px] text-muted-foreground text-right">{customRequests.length}/500</p>
              </div>
            </motion.div>
          )}

          {/* VERIFY EMAIL */}
          {currentStepLabel === "Verify" && (
            <motion.div key="verify" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.15 }} className="space-y-4">
              {/* Streamlined verify step (post auth-gate):
                  - Email is auto-filled from the logged-in account and
                    locked read-only. Anonymous users never reach here —
                    the auth gate redirects them to /auth?next=... first.
                  - The 7-digit code auto-sends on step entry (no button).
                  - Code input auto-validates as soon as 7 digits are typed.
                  - Phone is still a required day-of contact field. */}
              <div className="text-center space-y-1.5 mb-1">
                <Mail className="w-7 h-7 mx-auto text-muted-foreground" />
                <p className="text-base font-display font-semibold text-foreground">Check your email</p>
                <p className="text-xs font-body text-muted-foreground">
                  We sent a 7-digit code to{" "}
                  <span className="text-foreground font-medium">{email || "your inbox"}</span>
                </p>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label htmlFor="bm-name" className="text-[10px] font-display font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                    Full Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="bm-name"
                    type="text"
                    autoComplete="name"
                    autoCapitalize="words"
                    value={name}
                    onChange={(e) => { setName(e.target.value); if (emailVerified) setEmailVerified(false); }}
                    onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                    placeholder="Jane Doe"
                    className="w-full bg-background text-foreground border border-border rounded-md px-3 py-2.5 text-sm font-body focus:outline-none focus:border-chrome-dark transition-colors"
                  />
                  {touched.name && !name.trim() && (
                    <p className="text-[10px] text-destructive font-body">Enter your full name so we can check you in.</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label htmlFor="bm-email" className="text-[10px] font-display font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                    Email <span className="text-muted-foreground/60 text-[9px] tracking-normal normal-case">(verified at sign-up)</span>
                  </label>
                  <input
                    id="bm-email"
                    type="email"
                    value={email}
                    readOnly
                    aria-readonly="true"
                    tabIndex={-1}
                    className="w-full bg-muted/40 text-muted-foreground border border-border rounded-md px-3 py-2.5 text-sm font-body cursor-not-allowed"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="bm-phone" className="text-[10px] font-display font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                    Phone <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="bm-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => {
                      // Light US-style auto-format: (555) 555-1234. We only
                      // touch digits — keeps international users free to paste
                      // a +44 / +33 number and still get something sane.
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                      let formatted = digits;
                      if (digits.length === 10) {
                        formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
                      } else if (digits.length > 6) {
                        formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
                      } else if (digits.length > 3) {
                        formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
                      } else if (digits.length > 0) {
                        formatted = `(${digits}`;
                      }
                      setPhone(formatted);
                    }}
                    onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                    placeholder="(555) 555-1234"
                    className="w-full bg-background text-foreground border border-border rounded-md px-3 py-2.5 text-sm font-body focus:outline-none focus:border-chrome-dark transition-colors"
                  />
                  {touched.phone && phone.replace(/\D/g, "").length > 0 && phone.replace(/\D/g, "").length < 10 && (
                    <p className="text-[10px] text-destructive font-body">Enter a 10-digit phone number.</p>
                  )}
                  {touched.phone && phone.replace(/\D/g, "").length === 0 && (
                    <p className="text-[10px] text-destructive font-body">Phone is required for day-of contact.</p>
                  )}
                  <p className="text-[10px] text-muted-foreground font-body">For booking reminders and day-of contact only. We never share it.</p>
                </div>
              </div>
              {/* Code entry — always visible after auto-send. Auto-validates
                  on the 7th digit (handled by the auto-verify effect). */}
              <div className="space-y-2">
                <input
                  ref={verifyInputRef}
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  value={verificationCode}
                  onChange={(e) => { setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 7)); if (verifyError) setVerifyError(null); }}
                  className={cn(
                    "w-full bg-secondary text-foreground border rounded-md px-4 py-3 font-display text-2xl text-center tracking-[0.5em] focus:outline-none transition-colors",
                    verifyError ? "border-destructive focus:border-destructive" : "border-border focus:border-chrome-dark"
                  )}
                  placeholder="0000000"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  aria-label="7-digit verification code"
                  disabled={verifying || emailVerified}
                />
                <div className="flex items-center justify-between text-[10px] font-body text-muted-foreground">
                  <span>
                    {sending
                      ? "Sending code…"
                      : verifying
                      ? "Verifying…"
                      : codeSentAt
                      ? `Code sent ${codeSentSecondsAgo === 0 ? "just now" : `${codeSentSecondsAgo}s ago`}`
                      : "\u00A0"}
                  </span>
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={sending || resendIn > 0 || resendCount >= RESEND_MAX_PER_SESSION || codeSentSecondsAgo < 30}
                    className="underline-offset-2 hover:underline disabled:no-underline disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:text-foreground"
                  >
                    {resendCount >= RESEND_MAX_PER_SESSION
                      ? "Resend limit reached"
                      : resendIn > 0
                      ? `Resend in ${resendIn}s`
                      : codeSentSecondsAgo < 30 && codeSentAt
                      ? `Didn't get it? Resend in ${30 - codeSentSecondsAgo}s`
                      : "Didn't receive it? Resend"}
                  </button>
                </div>
                {verifyError && (
                  <p className="text-[11px] text-destructive font-body">{verifyError}</p>
                )}
              </div>
            </motion.div>
          )}

          {/* ID VERIFICATION */}
          {currentStepLabel === "ID" && (
            <motion.div key="id" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.15 }} className="space-y-4">
              <div className="text-center space-y-2">
                <ShieldCheck className="w-8 h-8 mx-auto text-muted-foreground" />
                <p className="text-sm font-display font-semibold text-foreground">Identity Verification</p>
                <p className="text-xs font-body text-muted-foreground">
                  Upload a photo of a valid government-issued ID (driver's license, passport, or state ID). This verifies your age and identity before your session.
                </p>
              </div>

              {!idUploaded ? (
                <div className="space-y-3">
                  {idPhoto && idPhotoPreview ? (
                    <div className="space-y-3">
                      <div className="relative rounded-md overflow-hidden border border-border">
                        <img src={idPhotoPreview} alt="ID preview" className="w-full h-40 object-cover" />
                        <button
                          onClick={() => { setIdPhoto(null); setIdPhotoPreview(null); }}
                          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-background/80 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                        >
                          ×
                        </button>
                      </div>
                      <div className="bg-secondary/50 rounded-md p-2 border border-border">
                        <p className="text-[10px] text-muted-foreground font-body">
                          🔒 Your ID is encrypted and stored securely. It will only be used for verification purposes and automatically deleted after your session.
                        </p>
                      </div>
                      <button
                        onClick={handleUploadId}
                        disabled={uploadingId}
                        className="w-full py-2.5 rounded-md chrome-btn font-display font-semibold text-xs uppercase tracking-[0.1em]"
                      >
                        {uploadingId ? "Uploading..." : "Submit ID for Verification"}
                      </button>
                    </div>
                  ) : (
                    <IdCameraCapture
                      onCapture={(file) => {
                        setIdPhoto(file);
                        setIdPhotoPreview(URL.createObjectURL(file));
                      }}
                      onUploadFallback={(file) => {
                        if (file.size > 10 * 1024 * 1024) {
                          toast.error("Photo must be under 10MB");
                          return;
                        }
                        if (!file.type.startsWith("image/")) {
                          toast.error("Please upload an image file");
                          return;
                        }
                        setIdPhoto(file);
                        setIdPhotoPreview(URL.createObjectURL(file));
                      }}
                    />
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 bg-secondary rounded-md border border-border">
                  <Check className="w-4 h-4 text-primary" />
                  <span className="text-xs font-body text-foreground">ID photo uploaded successfully</span>
                </div>
              )}

              <div className="text-[10px] text-muted-foreground font-body space-y-1">
                <p>• Must be a valid, non-expired government ID</p>
                <p>• Name on ID must match booking name</p>
                <p>• You must be 18+ to book a session</p>
              </div>
            </motion.div>
          )}

          {/* PR 4a — STRIPE IDENTITY VERIFICATION (new flow) */}
          {currentStepLabel === "VerifyStripe" && (
            <motion.div
              key="verify-stripe"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              {isVerificationApproved ? (
                // PR — Symmetric back-nav. User came back from Consent
                // already approved; show a confirmation card instead of
                // the Stripe launcher. Continue advances without re-firing
                // Stripe Identity (handled in handleNext).
                <div className="text-center space-y-2">
                  <Check className="w-8 h-8 mx-auto text-primary" />
                  <p className="text-sm font-display font-semibold text-foreground">
                    Identity verified
                  </p>
                  <p className="text-xs font-body text-muted-foreground">
                    You're all set on the ID side. Tap Continue to head back to
                    Consent and finish checkout.
                  </p>
                </div>
              ) : isGuest ? (
                loginMode ? (
                  <div className="text-center space-y-2">
                    <p className="text-sm font-display font-semibold text-foreground">
                      Welcome back
                    </p>
                    <p className="text-xs font-body text-muted-foreground">
                      You already have an account — sign in to finish your booking.
                    </p>
                  </div>
                ) : awaitingOtp ? (
                  <div className="text-center space-y-2">
                    <p className="text-sm font-display font-semibold text-foreground">
                      Verify your email
                    </p>
                    <p className="text-xs font-body text-muted-foreground">
                      We sent a 6-digit code to {email || "your email"}. Paste it below to continue.
                    </p>
                  </div>
                ) : (
                  <div className="text-center space-y-2">
                    <p className="text-sm font-display font-semibold text-foreground">
                      Almost done — your details
                    </p>
                    <p className="text-xs font-body text-muted-foreground">
                      Create your account to finish your booking. Next you'll verify
                      your ID with Stripe (you must be 18+).
                    </p>
                  </div>
                )
              ) : (
                <div className="text-center space-y-2">
                  <ShieldCheck className="w-8 h-8 mx-auto text-muted-foreground" />
                  <p className="text-sm font-display font-semibold text-foreground">
                    Verify your identity
                  </p>
                  <p className="text-xs font-body text-muted-foreground">
                    We use Stripe Identity to confirm you're 18+ and that your ID
                    is valid. You'll be redirected to a secure Stripe-hosted page
                    to scan your driver's license, passport, or state ID with a
                    matching selfie.
                  </p>
                </div>
              )}

              {/* GUEST (Layer 2): inline "your details" account form. Submit wires
                  to useInlineSignup (B2); the OTP sub-step swaps this out below. */}
              {isGuest && !awaitingOtp && !loginMode && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label htmlFor="bm-email-guest" className="text-[10px] font-display font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                      Email <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="bm-email-guest"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full bg-background text-foreground border border-border rounded-md px-3 py-2.5 text-sm font-body focus:outline-none focus:border-chrome-dark transition-colors"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="bm-password-guest" className="text-[10px] font-display font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                      Password <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="bm-password-guest"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a password"
                      className="w-full bg-background text-foreground border border-border rounded-md px-3 py-2.5 text-sm font-body focus:outline-none focus:border-chrome-dark transition-colors"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="bm-name-guest" className="text-[10px] font-display font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                      Full Name <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="bm-name-guest"
                      type="text"
                      autoComplete="name"
                      autoCapitalize="words"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="As it appears on your ID"
                      className="w-full bg-background text-foreground border border-border rounded-md px-3 py-2.5 text-sm font-body focus:outline-none focus:border-chrome-dark transition-colors"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-display font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                      Date of birth <span className="text-destructive">*</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        aria-label="Birth month"
                        value={dobMonth}
                        onChange={(e) => setDobMonth(e.target.value)}
                        className="w-full bg-background text-foreground border border-border rounded-md px-2 py-2.5 text-sm font-body focus:outline-none focus:border-chrome-dark transition-colors"
                      >
                        <option value="">Month</option>
                        {DOB_MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                      </select>
                      <select
                        aria-label="Birth day"
                        value={dobDay}
                        onChange={(e) => setDobDay(e.target.value)}
                        className="w-full bg-background text-foreground border border-border rounded-md px-2 py-2.5 text-sm font-body focus:outline-none focus:border-chrome-dark transition-colors"
                      >
                        <option value="">Day</option>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <select
                        aria-label="Birth year"
                        value={dobYear}
                        onChange={(e) => setDobYear(e.target.value)}
                        className="w-full bg-background text-foreground border border-border rounded-md px-2 py-2.5 text-sm font-body focus:outline-none focus:border-chrome-dark transition-colors"
                      >
                        <option value="">Year</option>
                        {DOB_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-body">
                      You must be 18+ to book. Stripe Identity confirms this against your ID.
                    </p>
                  </div>
                  <HCaptchaWidget ref={guestCaptchaRef} onVerify={(tok) => setCaptchaToken(tok)} onExpire={() => setCaptchaToken(null)} />
                  {/* Returning user? Switch to sign-in BEFORE submitting, instead of
                      only discovering it after email_exists detection on "Create account
                      & continue" (submit-detection stays as the safety net). Clears the
                      captcha so login mode requires its own fresh solve. */}
                  <p className="text-center text-[11px] font-body text-muted-foreground">
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => { setLoginMode(true); setCaptchaToken(null); }}
                      className="text-foreground underline underline-offset-2 hover:text-primary transition-colors font-semibold"
                    >
                      Sign in
                    </button>
                  </p>
                </div>
              )}

              {/* GUEST inline sign-in (Layer 2): existing account → password → Identity. */}
              {isGuest && loginMode && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label htmlFor="bm-email-login" className="text-[10px] font-display font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                      Email
                    </label>
                    <input
                      id="bm-email-login"
                      type="email"
                      value={email}
                      readOnly
                      aria-readonly="true"
                      tabIndex={-1}
                      className="w-full bg-muted/40 text-muted-foreground border border-border rounded-md px-3 py-2.5 text-sm font-body cursor-not-allowed"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="bm-password-login" className="text-[10px] font-display font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                      Password <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="bm-password-login"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Your password"
                      className="w-full bg-background text-foreground border border-border rounded-md px-3 py-2.5 text-sm font-body focus:outline-none focus:border-chrome-dark transition-colors"
                    />
                  </div>
                  {/* Fresh captcha required for the sign-in: the details-step token
                      was consumed by the signUp attempt, and login is server-gated
                      once security_captcha_enabled=true. */}
                  <HCaptchaWidget
                    ref={guestCaptchaRef}
                    onVerify={(tok) => setCaptchaToken(tok)}
                    onExpire={() => setCaptchaToken(null)}
                  />
                  <button
                    type="button"
                    onClick={() => { setLoginMode(false); setPassword(""); setCaptchaToken(null); }}
                    className="text-[11px] font-body text-muted-foreground underline hover:text-foreground transition-colors"
                  >
                    Use a different email
                  </button>
                </div>
              )}

              {/* GUEST OTP sub-step (A2): inline 6-digit code → verifyOtp → Identity. */}
              {isGuest && awaitingOtp && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label htmlFor="bm-otp-guest" className="text-[10px] font-display font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                      Verification code <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="bm-otp-guest"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="123456"
                      className="w-full bg-background text-foreground border border-border rounded-md px-3 py-2.5 text-base font-mono text-center tracking-[0.5em] focus:outline-none focus:border-chrome-dark transition-colors"
                    />
                    <p className="text-[10px] text-muted-foreground font-body">Enter the 6-digit code from your email.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleResendOtp()}
                    className="text-[11px] font-body text-muted-foreground underline hover:text-foreground transition-colors"
                  >
                    Didn't get it? Resend code
                  </button>
                </div>
              )}

              {/* SIGNED-IN: read-only confirm fields (unchanged from pre-Layer-2). */}
              {!isGuest && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label htmlFor="bm-name-vs" className="text-[10px] font-display font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                    Full Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="bm-name-vs"
                    type="text"
                    autoComplete="name"
                    autoCapitalize="words"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                    placeholder="As it appears on your ID"
                    className="w-full bg-background text-foreground border border-border rounded-md px-3 py-2.5 text-sm font-body focus:outline-none focus:border-chrome-dark transition-colors"
                  />
                  {touched.name && !name.trim() && (
                    <p className="text-[10px] text-destructive font-body">
                      Enter your full name as it appears on your ID.
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <label htmlFor="bm-email-vs" className="text-[10px] font-display font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                    Email <span className="text-muted-foreground/60 text-[9px] tracking-normal normal-case">(verified at sign-up)</span>
                  </label>
                  <input
                    id="bm-email-vs"
                    type="email"
                    value={email}
                    readOnly
                    aria-readonly="true"
                    tabIndex={-1}
                    className="w-full bg-muted/40 text-muted-foreground border border-border rounded-md px-3 py-2.5 text-sm font-body cursor-not-allowed"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="bm-phone-vs" className="text-[10px] font-display font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                    Phone <span className="text-muted-foreground/60 text-[9px] tracking-normal normal-case">(optional)</span>
                  </label>
                  <input
                    id="bm-phone-vs"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                      let formatted = digits;
                      if (digits.length > 6) {
                        formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
                      } else if (digits.length > 3) {
                        formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
                      } else if (digits.length > 0) {
                        formatted = `(${digits}`;
                      }
                      setPhone(formatted);
                    }}
                    onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                    placeholder="(555) 555-1234"
                    className="w-full bg-background text-foreground border border-border rounded-md px-3 py-2.5 text-sm font-body focus:outline-none focus:border-chrome-dark transition-colors"
                  />
                  {touched.phone && phone.replace(/\D/g, "").length > 0 && phone.replace(/\D/g, "").length < 10 && (
                    <p className="text-[10px] text-destructive font-body">
                      Enter a 10-digit phone number.
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground font-body">For booking reminders and day-of contact only.</p>
                </div>
              </div>
              )}

              {draftBookingId && (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-2 text-[10px] font-body text-primary">
                  Slot reserved for 30 minutes while you verify. Booking ref:{" "}
                  <span className="font-mono">{draftBookingId.slice(0, 8)}…</span>
                </div>
              )}

              <div className="text-[10px] text-muted-foreground font-body space-y-1">
                <p>• Stripe holds your ID image — we never store it on our side.</p>
                <p>• Image is deleted automatically per Stripe's retention policy.</p>
                <p>• You must be 18+ to book a session.</p>
              </div>
            </motion.div>
          )}

          {/* CONSENT AGREEMENT + SIGNATURE */}
          {currentStepLabel === "Consent" && (
            <motion.div key="consent" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.15 }} className="space-y-3">
              <div className="flex items-center gap-2">
                <FileSignature className="w-4 h-4 text-chrome" />
                <h3 className="font-display text-sm uppercase tracking-[0.15em] chrome-text">Studio Consent Agreement</h3>
              </div>
              <p className="text-[11px] font-body text-muted-foreground">
                Please review and sign. Your signature confirms you've read and accept the full agreement below.
              </p>
              {/* Live ID pre-check status — runs in parallel with the signature pad.
                  Advisory only; doesn't block proceeding. */}
              {idPrevalidateResult && (
                <div
                  className={cn(
                    "rounded-md border p-2 text-[10px] font-body flex items-start gap-2",
                    idPrevalidateResult.status === "ok"
                      ? "border-primary/30 bg-primary/5 text-primary"
                      : idPrevalidateResult.status === "rejected"
                        ? "border-destructive/40 bg-destructive/5 text-destructive"
                        : "border-border bg-secondary/40 text-muted-foreground",
                  )}
                >
                  {idPrevalidateResult.status === "ok" ? (
                    <Check className="w-3 h-3 mt-0.5 shrink-0" />
                  ) : (
                    <ShieldCheck className="w-3 h-3 mt-0.5 shrink-0" />
                  )}
                  <span>
                    {idPrevalidateResult.status === "ok"
                      ? "ID auto-verified — name matches your booking."
                      : idPrevalidateResult.status === "rejected"
                        ? "We couldn't verify your ID image. You can still proceed; staff will review at check-in."
                        : "ID is being reviewed. You can continue — final verification happens at check-in."}
                  </span>
                </div>
              )}

              {/* Collapsible full agreement */}
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

              {/* Printed name */}
              <div className="space-y-1">
                <label className="text-[10px] font-display font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  Your Full Legal Name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="As it appears on your ID"
                  className="w-full bg-background text-foreground border border-border rounded-md px-3 py-2 text-xs font-body focus:outline-none focus:border-chrome-dark transition-colors"
                />
              </div>

              {/* Guest signature */}
              <div className="space-y-1">
                <label className="text-[10px] font-display font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  Guest Signature
                </label>
                <SignaturePad onChange={setConsentSignature} />
              </div>

              {/* Auto studio rep signature */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-display font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                    Studio Representative
                  </label>
                  <span className="text-[9px] font-body text-success uppercase tracking-wider">✓ Auto-signed</span>
                </div>
                <div className="rounded-md border border-border bg-secondary/40 p-2">
                  <StudioRepSignature className="w-full h-16" />
                  <p className="text-[9px] text-muted-foreground font-body text-center mt-1">
                    Replay Club · Authorized Representative · {format(new Date(), "MMM d, yyyy")}
                  </p>
                </div>
              </div>

              {!consentSignature && (
                <p className="text-[10px] text-muted-foreground font-body italic text-center">
                  Sign above to continue to payment
                </p>
              )}
            </motion.div>
          )}

          {/* REVIEW & PAY */}
          {currentStepLabel === "Pay" && (
            <motion.div key="pay" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.15 }} className="space-y-4">
              {!isEquipmentRental && holdExpiresAt && holdRemainingMs > 0 && (
                <div className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md border text-xs font-body",
                  holdRemainingMs < 60_000
                    ? "border-destructive/40 bg-destructive/10"
                    : holdRemainingMs < 3 * 60_000
                      ? "border-amber-500/40 bg-amber-500/10"
                      : "border-primary/30 bg-primary/5"
                )}>
                  <Clock className={cn(
                    "w-3.5 h-3.5",
                    holdRemainingMs < 60_000 ? "text-destructive"
                    : holdRemainingMs < 3 * 60_000 ? "text-amber-400"
                    : "text-primary"
                  )} />
                  <span className="text-muted-foreground">Your slot is locked for</span>
                  <span className="font-display font-semibold chrome-text">
                    {Math.floor(holdRemainingMs / 60000)}:{String(Math.floor((holdRemainingMs % 60000) / 1000)).padStart(2, "0")}
                  </span>
                  <span className="text-muted-foreground">— finish payment to secure it.</span>
                </div>
              )}
              {!isEquipmentRental && otherViewers > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-primary/40 bg-primary/10 text-xs font-body text-foreground">
                  <Bell className="w-3.5 h-3.5" />
                  <span>
                    {otherViewers === 1
                      ? "Someone else is also viewing this slot. Complete checkout soon to secure it."
                      : `${otherViewers} others are also viewing this slot. Complete checkout soon.`}
                  </span>
                </div>
              )}
              {/* Refund / cancellation policy — expandable */}
              <details className="group rounded-md border border-border bg-secondary/40 text-[11px] font-body open:bg-secondary/60 transition-colors">
                <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden">
                  <Clock className="w-3.5 h-3.5 text-foreground shrink-0" />
                  <span className="text-foreground font-display font-semibold uppercase tracking-[0.12em] text-[10px] flex-1">
                    Refund &amp; Cancellation Policy
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-3 pb-3 pt-1 text-muted-foreground leading-relaxed space-y-1.5">
                  <p>
                    Free reschedule or cancellation up to{" "}
                    <span className="text-foreground font-semibold">24 hours</span>{" "}
                    before your session.
                  </p>
                  <p>Late cancellations and no-shows are non-refundable.</p>
                  <p className="text-[10px] opacity-80">
                    Equipment damage, missing items, or extended use beyond the booked window may incur additional charges.
                  </p>
                </div>
              </details>
              <div className="bg-secondary rounded-md p-4 text-sm font-body border border-border space-y-2">
                <p className="text-foreground font-semibold font-display">{room?.title}</p>
                {date && <p className="text-muted-foreground text-xs">{format(date, "EEEE, MMMM do yyyy")} · {time || "TBD"}</p>}
                {!isEquipmentRental && hours && <p className="text-muted-foreground text-xs">{hours} hour session</p>}
                {selectedTier && <p className="text-muted-foreground text-xs">{selectedTier}</p>}
                {isEquipmentRental && (
                  <p className="text-muted-foreground text-xs">{hours} hour session</p>
                )}
                {isEquipmentRental && selectedEquipment!.map((item) => {
                  const bdCents = backdropPriceCentsByName(item);
                  if (bdCents !== null) {
                    const lineCents = bdCents * hours;
                    return (
                      <div key={item} className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">
                          {item} <span className="text-[10px] text-muted-foreground/70">${(bdCents / 100).toFixed(0)}/hr × {hours}h</span>
                        </span>
                        <span className="text-xs font-semibold text-foreground">${(lineCents / 100).toFixed(2)}</span>
                      </div>
                    );
                  }
                  const pkgCents = photoPackageCentsByName(item);
                  if (pkgCents !== null) {
                    return (
                      <div key={item} className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">{item} <span className="text-[10px] text-muted-foreground/70">flat fee</span></span>
                        <span className="text-xs font-semibold text-foreground">${(pkgCents / 100).toFixed(2)}</span>
                      </div>
                    );
                  }
                  const bundleCents = addonBundleCentsByName(item);
                  if (bundleCents !== null) {
                    return (
                      <div key={item} className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">{item}</span>
                        <span className="text-xs font-semibold text-foreground">${(bundleCents / 100).toFixed(0)}/day</span>
                      </div>
                    );
                  }
                  return (
                    <div key={item} className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">{item}</span>
                      <span className="text-xs font-semibold text-foreground">${rentalPriceMap[item] || 0}/day</span>
                    </div>
                  );
                })}
                <div className="border-t border-border pt-2 mt-2 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Subtotal</span>
                    <span className="text-xs text-foreground font-display">${(getAmountCents() / 100).toFixed(2)}</span>
                  </div>
                  {loyaltyDiscount && loyaltyDiscount.percent > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-primary font-body">
                        🏆 {loyaltyDiscount.tier} Loyalty ({loyaltyDiscount.percent}% off)
                      </span>
                      <span className="text-xs text-primary font-display font-semibold">
                        -${((getAmountCents() - getSubtotalAfterLoyalty()) / 100).toFixed(2)}
                      </span>
                    </div>
                  )}
                  {discountApplied && getPromoDiscountCents() > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-body text-success">
                        🏷️ Promo ({discountApplied.code})
                      </span>
                      <span className="text-xs text-success font-display font-semibold">
                        -${(getPromoDiscountCents() / 100).toFixed(2)}
                      </span>
                    </div>
                  )}
                  {giftCardApplied && getGiftCardDiscount() > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-body text-success">
                        🎁 Gift Card ({giftCardApplied.code})
                      </span>
                      <span className="text-xs text-success font-display font-semibold">
                        -${(getGiftCardDiscount() / 100).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-1 border-t border-border">
                    <span className="text-foreground font-semibold">Total</span>
                    <span className="text-lg font-display font-bold chrome-text">
                      {getAmountDisplay()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Discount Code Input */}
              <div className="border border-border rounded-md p-3 space-y-2">
                <p className="text-[10px] font-display font-semibold uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1.5">
                  <Tag className="w-3 h-3" /> Discount Code
                </p>
                {discountApplied ? (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-body text-success flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      {discountApplied.code} — ${(discountApplied.amountCents / 100).toFixed(2)} off
                    </span>
                    <button
                      onClick={() => { setDiscountApplied(null); setDiscountCodeInput(""); }}
                      className="text-[10px] text-muted-foreground hover:text-destructive transition-colors font-display uppercase tracking-wider"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      value={discountCodeInput}
                      onChange={(e) => { setDiscountCodeInput(e.target.value.toUpperCase()); setDiscountError(""); }}
                      placeholder="ENTER CODE"
                      className="flex-1 bg-background text-foreground border border-border rounded-md px-3 py-2 text-xs font-display tracking-wider focus:outline-none focus:border-chrome-dark transition-colors"
                    />
                    <button
                      onClick={handleApplyDiscountCode}
                      disabled={!discountCodeInput.trim() || applyingDiscount}
                      className="px-4 py-2 rounded-md chrome-btn-outline font-display font-semibold text-[10px] uppercase tracking-[0.1em] disabled:opacity-50"
                    >
                      {applyingDiscount ? <Loader2 className="w-3 h-3 animate-spin" /> : "Apply"}
                    </button>
                  </div>
                )}
                {discountError && (
                  <p className="text-[10px] text-destructive font-body">{discountError}</p>
                )}
              </div>

              <div className="border border-border rounded-md p-3 space-y-2">
                <p className="text-[10px] font-display font-semibold uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1.5">
                  <Gift className="w-3 h-3" /> Gift Card
                </p>
                {giftCardApplied ? (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-body text-success flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      {giftCardApplied.code} — ${(giftCardApplied.balanceCents / 100).toFixed(2)} balance
                    </span>
                    <button
                      onClick={() => { setGiftCardApplied(null); setGiftCardCode(""); }}
                      className="text-[10px] text-muted-foreground hover:text-destructive transition-colors font-display uppercase tracking-wider"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      value={giftCardCode}
                      onChange={(e) => { setGiftCardCode(e.target.value.toUpperCase()); setGiftCardError(""); }}
                      placeholder="RC-XXXXXXXX"
                      className="flex-1 bg-background text-foreground border border-border rounded-md px-3 py-2 text-xs font-display tracking-wider focus:outline-none focus:border-chrome-dark transition-colors"
                    />
                    <button
                      onClick={handleApplyGiftCard}
                      disabled={!giftCardCode.trim() || applyingGiftCard}
                      className="px-4 py-2 rounded-md chrome-btn-outline font-display font-semibold text-[10px] uppercase tracking-[0.1em] disabled:opacity-50"
                    >
                      {applyingGiftCard ? <Loader2 className="w-3 h-3 animate-spin" /> : "Apply"}
                    </button>
                  </div>
                )}
                {giftCardError && (
                  <p className="text-[10px] text-destructive font-body">{giftCardError}</p>
                )}
              </div>

              <div className="text-[10px] text-muted-foreground font-body space-y-1">
                <p>✓ Email verified: {email}</p>
                {idUploaded && <p>✓ ID photo submitted for verification</p>}
                <p>✓ Confirmation will be sent to {email}</p>
              </div>

              {/* Master consent block — single-checkbox version (Fix 3, v1.0).
                  Shows all 5 binding terms as bullets, one master "I agree"
                  checkbox below. Pay button is disabled until checked. */}
              <div className="space-y-3 rounded-md border border-border/60 bg-secondary/30 p-3.5">
                <p className="text-[11px] font-display font-semibold uppercase tracking-[0.15em] text-foreground">
                  Before you book — please confirm:
                </p>
                <ul className="space-y-2 text-[12px] font-body text-muted-foreground leading-relaxed list-disc pl-4 marker:text-foreground/60">
                  <li>
                    <span className="text-foreground font-semibold">Liability Waiver.</span>{" "}
                    I understand that Replay Club is a working professional studio. I use the space at my own risk and acknowledge the inherent risks of working with audio equipment, electrical gear, cables, and active session environments. I release Replay Club, its owners, and operators from any claims arising from my use of the space, except in cases of gross negligence.
                  </li>
                  <li>
                    <span className="text-foreground font-semibold">Equipment Damage Responsibility.</span>{" "}
                    I am responsible for any damage to studio equipment, furniture, or the premises during my booked session — caused by me, my guests, or my gear. Damages will be assessed and charged to the card on file with photo documentation provided before any charge.
                  </li>
                  <li>
                    <span className="text-foreground font-semibold">ID Verification &amp; Security Recording.</span>{" "}
                    I consent to ID verification before my session and acknowledge that the entire Replay Club premises is monitored by audio and video surveillance, retained for security and legal purposes per California Civil Code.
                  </li>
                  <li>
                    <span className="text-foreground font-semibold">House Rules &amp; Conduct Standards.</span>{" "}
                    I have read and agree to the{" "}
                    <a href="/policies" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="underline text-foreground">Replay Club House Rules</a>{" "}and{" "}
                    <a href="/conduct" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="underline text-foreground">Conduct Standards</a>. Violations may result in immediate session termination, removal from the premises, and forfeiture of payment.
                  </li>
                  <li>
                    <span className="text-foreground font-semibold">Cancellation Policy.</span>{" "}
                    Free{" "}
                    <a href="/cancellation" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="underline text-foreground">cancellation</a>{" "}
                    up to 24 hours before the session. Within 24 hours: studio credit issued (no cash refund). No-shows forfeit the full session fee.
                  </li>
                </ul>
                <label className="flex items-start gap-2.5 cursor-pointer group pt-1 border-t border-border/40">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setTermsAccepted(checked);
                      setConsentAcceptedAt(checked ? new Date().toISOString() : null);
                    }}
                    className="mt-1 accent-chrome w-4 h-4 rounded border-border"
                  />
                  <span className="text-[13px] font-body text-foreground leading-relaxed">
                    I have read and agree to all of the above terms and conditions.
                  </span>
                </label>
                <p className="text-[10px] font-body text-muted-foreground/70 text-center">
                  By clicking "Pay" you confirm all of the above.
                </p>
              </div>
              {/* Trust strip: shown right above the Pay CTA so users see
                  the secure-checkout signal + accepted methods before clicking. */}
              <div className="flex flex-col items-center gap-1.5 pt-2">
                <div className="flex items-center gap-1.5 text-[10px] font-body uppercase tracking-[0.15em] text-muted-foreground">
                  <Lock className="w-3 h-3" />
                  Secure checkout · powered by Stripe
                </div>
                <div className="flex items-center gap-1.5 opacity-80" aria-label="Accepted payment methods">
                  <span className="px-1.5 py-0.5 rounded bg-card border border-border text-[9px] font-display font-bold tracking-wider text-foreground">VISA</span>
                  <span className="px-1.5 py-0.5 rounded bg-card border border-border text-[9px] font-display font-bold tracking-wider text-foreground">MC</span>
                  <span className="px-1.5 py-0.5 rounded bg-card border border-border text-[9px] font-display font-bold tracking-wider text-foreground">AMEX</span>
                  <span className="px-1.5 py-0.5 rounded bg-card border border-border text-[9px] font-display font-bold tracking-wider text-foreground">Apple Pay</span>
                  <span className="px-1.5 py-0.5 rounded bg-card border border-border text-[9px] font-display font-bold tracking-wider text-foreground">G Pay</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation buttons — sticky on mobile so the keyboard never hides them. */}
        {currentStepLabel !== "Verify" && (
          <div className="sticky bottom-0 left-0 right-0 -mx-4 px-4 pt-3 pb-[env(safe-area-inset-bottom)] mt-4 bg-gradient-to-t from-background via-background to-background/95 border-t border-border/40">
            <div className="flex gap-3">
              {step > 0 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className="flex-1 py-2.5 rounded-md chrome-btn-outline font-display font-semibold text-xs uppercase tracking-[0.1em] transition-all"
                >
                  Back
                </button>
              )}
              <button
                onClick={handleNext}
                disabled={!canProceed() || paying || sending || creatingDraft || startingStripeIdentity}
                className={cn(
                  "flex-1 py-2.5 rounded-md font-display font-semibold text-xs uppercase tracking-[0.1em] transition-all",
                  canProceed() && !paying && !creatingDraft && !startingStripeIdentity && !inlineSignup.loading
                    ? "chrome-btn"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                {paying
                  ? "Redirecting to payment..."
                  : inlineSignup.loading
                    ? (loginMode ? "Signing in..." : awaitingOtp ? "Verifying code..." : "Creating your account...")
                    : startingStripeIdentity
                      ? "Opening Stripe Identity..."
                      : creatingDraft
                        ? "Reserving your slot..."
                        : currentStepLabel === "Pay"
                          ? `Pay ${getAmountDisplay()}`
                          : currentStepLabel === "VerifyStripe"
                            ? (isVerificationApproved ? "Continue" : isGuest ? (loginMode ? "Sign in & continue" : awaitingOtp ? "Verify & continue" : "Create account & continue") : "Verify with Stripe")
                            : "Continue"}
              </button>
            </div>
            {currentStepLabel === "Pay" && !termsAccepted && (
              <p className="mt-2 text-[11px] font-body text-muted-foreground text-center">
                Please accept the terms above to enable payment.
              </p>
            )}
            {currentStepLabel === "VerifyStripe" && !isVerificationApproved && !canProceed() && (
              <p className="mt-2 text-[11px] font-body text-muted-foreground text-center">
                {!name.trim()
                  ? "Enter your full name (as it appears on your ID) to continue."
                  : "Something went wrong loading your details. Please refresh the page and try again."}
              </p>
            )}
          </div>
        )}
    </BookingFlowShell>
    <ImageLightbox
      images={effectiveBackdrops.map((b) => ({ url: b.image, alt: b.name }))}
      startIndex={backdropPreviewIndex >= 0 ? backdropPreviewIndex : 0}
      open={backdropPreviewIndex >= 0}
      onClose={() => setBackdropPreviewIndex(-1)}
    />
    </>
  );
};

export default BookingModal;
