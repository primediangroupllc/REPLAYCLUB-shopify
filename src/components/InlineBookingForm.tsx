import { forwardRef, useImperativeHandle, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { findGlossaryEntry } from "@/lib/featureGlossary";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { getTimeSlotsForRoom } from "@/lib/bookingTimeSlots";
import { FALLBACK_IMAGES } from "@/hooks/useBackdrops";

interface InlineTier {
  label: string;
  price: string;
  features: string[];
}

interface InlineBackdrop {
  id?: string;
  name: string;
  image_url?: string;
}

export interface InlineBookingFormState {
  date?: Date;
  time?: string;
  tierIdx?: number;
  backdrop?: string;
  hours: number;
}

/** Imperative handle exposed via ref. Lets the sticky mobile CTA on
 * ServiceLandingPage trigger the same validate-and-continue flow as the
 * in-form Continue buttons. */
export interface InlineBookingFormHandle {
  continue: () => void;
}

interface InlineBookingFormProps {
  /** Booking deep-link slug (e.g. "dj"). */
  slug: string;
  /** Human-friendly title for the form heading. */
  roomTitle: string;
  tiers: InlineTier[];
  /** Lookahead in days for the date picker. */
  lookaheadDays?: number;
  /** Controlled state. */
  value: InlineBookingFormState;
  onChange: (next: InlineBookingFormState) => void;
  /** When true, Continue is blocked until a backdrop is selected. The
   * parent (ServiceLandingPage) owns the backdrop gallery so it provides
   * a scroll-to-gallery callback fired when the user hits Continue without
   * a backdrop. */
  requireBackdrop?: boolean;
  onMissingBackdrop?: () => void;
  /** Inline single-page flow: when provided, "Continue" hands off in-page
   * (to the BookingModal rendered below on the landing page) instead of
   * navigating to the homepage modal. */
  onInlineContinue?: () => void;
  /** Static highlights to show as the included-features list when the
   * service has no priced tiers (e.g. Livestream's "Custom Quote" model).
   * Ignored when `tiers` is non-empty — there the picked tier drives the
   * list. */
  highlights?: string[];
  /** Backdrops list (same shape as ServiceLandingPage's setupsGallery) so
   * the order preview can render the selected backdrop's image. */
  backdrops?: InlineBackdrop[];
}

const todayMidnight = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// Parse the FIRST $N in the tier price string into cents/hour.
// Same shape as parseTierPrice in BookingModal.
const parseHourlyCents = (priceStr: string): number => {
  const m = priceStr.match(/\$(\d+(?:\.\d{1,2})?)/);
  if (!m) return 0;
  return Math.round(parseFloat(m[1]) * 100);
};

// Parse "+ $N flat" if present.
const parseFlatCents = (priceStr: string): number => {
  const m = priceStr.match(/\+\s*\$(\d+(?:\.\d{1,2})?)\s*flat/i);
  if (!m) return 0;
  return Math.round(parseFloat(m[1]) * 100);
};

// Parse a slot like "2:00 PM" → 24h-clock hour (14). Returns null if the
// format doesn't match the expected ALL_HOURLY_SLOTS shape.
const slotToHour24 = (slot: string): number | null => {
  const m = slot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  const period = m[3].toUpperCase();
  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;
  return hour;
};

// Format a 24h-clock hour back to "H:MM AM/PM" matching the slot list.
const hour24ToSlot = (hour: number): string => {
  const safeHour = ((hour % 24) + 24) % 24;
  const period = safeHour < 12 ? "AM" : "PM";
  const display = safeHour % 12 === 0 ? 12 : safeHour % 12;
  return `${display}:00 ${period}`;
};

/**
 * Inline date/time/tier/backdrop picker rendered on service landing pages.
 * State is controlled by the parent (ServiceLandingPage) so the rest of the
 * page (backdrop gallery, "What's Included" list) can react to picks too.
 */
const InlineBookingForm = forwardRef<InlineBookingFormHandle, InlineBookingFormProps>(({
  slug,
  roomTitle,
  tiers,
  lookaheadDays = 90,
  value,
  onChange,
  requireBackdrop = false,
  onMissingBackdrop,
  highlights,
  backdrops,
  onInlineContinue,
}, ref) => {
  const navigate = useNavigate();
  const dateRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLDivElement>(null);
  const tierRef = useRef<HTMLDivElement>(null);
  const slots = getTimeSlotsForRoom(roomTitle);
  const hasTiers = tiers.length > 0;

  // Live slot availability: when a date is picked, fetch paid bookings +
  // in-flight slot_locks for that day so taken slots can render as
  // disabled. Mirrors the same query BookingModal uses so the inline
  // picker matches the modal's truth.
  const dateStr = value.date ? format(value.date, "yyyy-MM-dd") : null;
  const { data: slotInfo } = useQuery({
    queryKey: ["inline-booking-slots", roomTitle, dateStr],
    enabled: !!dateStr,
    staleTime: 30_000,
    refetchInterval: dateStr ? 30_000 : false,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      if (!dateStr) return { booked: [] as string[], locked: [] as string[] };
      const [bookingsRes, locksRes] = await Promise.all([
        supabase
          .from("bookings")
          .select("booking_time")
          .eq("booking_date", dateStr)
          .eq("room_title", roomTitle)
          .in("payment_status", ["paid", "promo"]),
        supabase.rpc("get_active_slot_locks"),
      ]);
      const booked = (bookingsRes.data ?? [])
        .map((b: any) => b.booking_time)
        .filter(Boolean) as string[];
      const locked = ((locksRes.data ?? []) as Array<{
        room_title: string;
        booking_date: string;
        booking_time: string;
      }>)
        .filter((l) => l.room_title === roomTitle && l.booking_date === dateStr)
        .map((l) => l.booking_time)
        .filter(Boolean);
      return { booked, locked };
    },
  });
  const bookedSet = new Set(slotInfo?.booked ?? []);
  const lockedSet = new Set(slotInfo?.locked ?? []);
  const scrollIntoView = (el: HTMLElement | null) => {
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // Auto-advance nudge after a pick (date→time, time→tier). On phones the
  // picker is a single column and the next field already sits just under the
  // thumb, so a programmatic scrollIntoView({block:"center"}) yanks the
  // calendar out of view and — on iOS Safari — reads as a disorienting
  // zoom/reflow (bug A0). Skip it under `sm`; keep the guided scroll on
  // tablet/desktop. NOTE: the validation scroll (handleContinue) is
  // intentionally NOT routed through here — jumping to a missing field on
  // Continue is helpful on every viewport. Don't "simplify" this back to a
  // plain scrollIntoView.
  const advanceScrollTo = (el: HTMLElement | null) => {
    if (!el) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 639px)").matches
    )
      return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const selectedTier = value.tierIdx !== undefined ? tiers[value.tierIdx] : undefined;
  const priceCents = selectedTier
    ? parseHourlyCents(selectedTier.price) * value.hours +
      parseFlatCents(selectedTier.price)
    : 0;
  const priceLabel = priceCents > 0 ? `$${(priceCents / 100).toFixed(0)}` : "—";

  // Session window — combine the picked time + duration into "Start – End"
  // so the user always sees the block they're committing to.
  const sessionWindow = (() => {
    if (!value.time) return null;
    const start = slotToHour24(value.time);
    if (start === null) return null;
    const end = start + value.hours;
    return `${value.time} – ${hour24ToSlot(end)}`;
  })();

  const handleContinue = () => {
    // Validate fields in display order so the toast/scroll lands on the
    // first thing the user has missed. Backdrop is gated by the parent
    // since the gallery lives outside the form.
    if (requireBackdrop && !value.backdrop) {
      toast.error("Please pick a backdrop above to continue.");
      onMissingBackdrop?.();
      return;
    }
    if (!value.date) {
      toast.error("Please pick a date to continue.");
      scrollIntoView(dateRef.current);
      return;
    }
    if (!value.time) {
      toast.error("Please pick a time to continue.");
      scrollIntoView(timeRef.current);
      return;
    }
    if (hasTiers && value.tierIdx === undefined) {
      toast.error("Please pick a tier to continue.");
      scrollIntoView(tierRef.current);
      return;
    }
    // Inline single-page flow: hand off to the in-page BookingModal below
    // instead of navigating to the homepage modal.
    if (onInlineContinue) {
      onInlineContinue();
      return;
    }
    const params = new URLSearchParams();
    params.set("book", slug);
    params.set("date", format(value.date, "yyyy-MM-dd"));
    if (value.time) params.set("time", value.time);
    if (value.tierIdx !== undefined) params.set("tier_idx", String(value.tierIdx));
    if (value.backdrop) params.set("backdrop", value.backdrop);
    params.set("step", "Customize");
    navigate(`/?${params.toString()}`, { state: { openBookingFor: slug } });
  };

  useImperativeHandle(ref, () => ({ continue: handleContinue }), [handleContinue]);

  return (
    // overflow-x-clip (mobile/tablet only) contains any child transform/ring
    // so a selected button's scale can't leak a horizontal sliver onto the
    // document (bug A0, effect 2). `clip` — not `hidden` — so it never becomes
    // a scroll container; reset to `visible` at lg so the desktop sticky aside
    // (lg:sticky below) is unaffected.
    <div className="card-premium p-3 sm:p-8 overflow-x-clip lg:overflow-x-visible">
      <div className="pb-4 mb-6 border-b border-border/30">
        <h3 className="font-display text-lg sm:text-xl font-bold chrome-text uppercase tracking-[0.15em]">
          Book your session
        </h3>
        <p className="text-[11px] text-muted-foreground font-body mt-1 tracking-wide">
          Pick your options. Verify + payment on the next screen.
        </p>
      </div>

      {/* Two-column layout on desktop: pickers left, sticky order/CTA on
          the right that stays visible as the user scrolls through tier
          features. Stacks on mobile (single column). */}
      <div className="grid gap-8 lg:grid-cols-[1fr,18rem]">
        <div className="space-y-7">

      <div className="grid gap-6 lg:grid-cols-[auto,1fr]">
        {/* Date */}
        <div ref={dateRef} className="flex justify-center lg:justify-start">
          <Calendar
            mode="single"
            selected={value.date}
            onSelect={(d) => {
              onChange({ ...value, date: d, time: undefined });
              // Guide the user to the next step (desktop/tablet only — see
              // advanceScrollTo; skipping under sm prevents the A0 yank-scroll).
              requestAnimationFrame(() => advanceScrollTo(timeRef.current));
            }}
            disabled={(d) => {
              if (d < todayMidnight()) return true;
              const max = new Date(todayMidnight());
              max.setDate(max.getDate() + Math.max(0, lookaheadDays));
              return d > max;
            }}
            // Fluid on mobile (fill the card down to 320px so the 7-col grid
            // never clips — bug A1), fixed 36px from lg up to preserve the
            // verified desktop layout + the [auto,1fr] column sizing.
            className="p-1 sm:p-3 pointer-events-auto w-full lg:w-auto"
            classNames={{
              months: "w-full lg:w-auto flex flex-col",
              month: "w-full lg:w-auto space-y-4",
              table: "w-full border-collapse",
              head_row: "flex w-full",
              head_cell:
                "flex-1 lg:flex-none lg:w-9 text-zinc-300 rounded-md font-medium text-[0.8rem] uppercase tracking-wider",
              row: "flex w-full mt-1.5",
              cell:
                "flex-1 lg:flex-none lg:w-9 h-9 p-0 relative text-center focus-within:relative focus-within:z-20",
              caption_label: "text-sm font-medium text-zinc-100",
              day: cn(
                "w-full h-9 lg:w-9 p-0 font-medium rounded-md inline-flex items-center justify-center text-zinc-100 transition-colors hover:bg-zinc-800 hover:text-white aria-selected:opacity-100",
              ),
              day_selected:
                "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground ring-1 ring-zinc-300",
              day_today: "bg-zinc-800 text-white ring-1 ring-zinc-500",
              day_outside: "text-zinc-600 opacity-100",
              day_disabled:
                "text-zinc-600 opacity-60 hover:bg-transparent hover:text-zinc-600 cursor-not-allowed",
            }}
          />
        </div>

        {/* Time + Tier + Hours */}
        <div className="space-y-5">
          <div ref={timeRef} className="space-y-2">
            <p className="font-display text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">
              Time
            </p>
            {!value.date ? (
              <p className="text-[11px] text-muted-foreground font-body italic">
                Pick a date first.
              </p>
            ) : slots.length === 0 ? (
              <p className="text-[11px] text-muted-foreground font-body">
                No fixed time slots — next screen handles it.
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {slots.map((slot) => {
                  const isBooked = bookedSet.has(slot);
                  const isLocked = !isBooked && lockedSet.has(slot);
                  const isTaken = isBooked || isLocked;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => {
                        if (isTaken) return;
                        onChange({ ...value, time: slot });
                        // Guide to the next field (desktop/tablet only — see
                        // advanceScrollTo; the under-sm skip is the core A0 fix).
                        requestAnimationFrame(() =>
                          advanceScrollTo(hasTiers ? tierRef.current : null),
                        );
                      }}
                      disabled={isTaken}
                      title={
                        isBooked
                          ? "Already booked"
                          : isLocked
                            ? "Someone is checking out — try again shortly"
                            : undefined
                      }
                      className={cn(
                        "py-2 px-2 rounded-md text-[11px] font-body transition-all border",
                        isTaken
                          ? "border-border/40 bg-muted/30 text-muted-foreground/50 line-through cursor-not-allowed"
                          : value.time === slot
                            ? "chrome-btn border-transparent scale-[1.02] ring-2 ring-primary/40 shadow-md shadow-primary/20"
                            : "chrome-btn-outline",
                      )}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {hasTiers && (
            <div ref={tierRef} className="space-y-2">
              <p className="font-display text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">
                Tier
              </p>
              <div className="grid gap-2">
                {tiers.map((t, i) => (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() => onChange({ ...value, tierIdx: i })}
                    className={cn(
                      "text-left p-3 rounded-md border transition-all",
                      value.tierIdx === i
                        // No scale transform on the selected state: the tier button
                        // is full card-width, so scaling it up overflows the card's
                        // right edge — and the card's overflow-x-clip is a silent
                        // no-op on iOS Safari < 16, so it visibly clips. Ring + bg
                        // change are enough selection feedback.
                        ? "chrome-btn border-transparent ring-2 ring-primary/40 shadow-md shadow-primary/20"
                        : "chrome-btn-outline",
                    )}
                  >
                    <span className="font-display text-xs font-bold uppercase tracking-wider">
                      {t.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* What's Included — only renders once a tier is selected.
                  Items come straight from the tier's `features` array
                  (admin-editable at /admin/services). */}
              {selectedTier && selectedTier.features.length > 0 && (
                <motion.div
                  key={value.tierIdx}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-4 rounded-lg border border-primary/30 bg-card/40 p-5 space-y-3"
                >
                  <p className="font-display text-[11px] uppercase tracking-[0.2em] text-primary font-semibold">
                    Included with {selectedTier.label}
                  </p>
                  <TooltipProvider delayDuration={200}>
                    <ul className="space-y-2.5">
                      {selectedTier.features.map((item, i) => {
                        const explanation = findGlossaryEntry(item);
                        return (
                          <li
                            key={`${value.tierIdx}-${i}`}
                            className="flex items-start gap-2.5 text-sm font-body text-foreground leading-relaxed"
                          >
                            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                            {/* min-w-0 + break-words is the SOURCE fix for the tier
                                horizontal-overflow (bug F1, hit on FX3): a flex child
                                defaults to min-width:auto and refuses to shrink below
                                its content's intrinsic width, so a long feature string
                                pushes the row wider than the card. The card's
                                overflow-x-clip is a SECOND layer that only catches it on
                                iOS Safari ≥16 (overflow:clip is unsupported below 16).
                                Keep BOTH layers — they are not redundant. */}
                            <span className="flex-1 min-w-0 break-words">{item}</span>
                            {explanation && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    aria-label="What is this?"
                                    className="shrink-0 text-muted-foreground/70 hover:text-primary transition-colors mt-0.5"
                                  >
                                    <Info className="w-3.5 h-3.5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="max-w-xs">
                                  <p className="text-xs leading-relaxed">{explanation}</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </TooltipProvider>
                </motion.div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <p className="font-display text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">
                Duration (hours)
              </p>
              {sessionWindow && (
                <p className="text-[11px] font-body text-foreground">
                  <span className="font-display uppercase tracking-wider text-[9px] text-muted-foreground mr-1.5">
                    Session
                  </span>
                  {sessionWindow}
                </p>
              )}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {[2, 3, 4, 5, 6].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => onChange({ ...value, hours: h })}
                  className={cn(
                    "py-2 px-3 rounded-md text-[11px] font-body transition-all border min-w-[44px]",
                    value.hours === h
                      ? "chrome-btn border-transparent scale-[1.05] ring-2 ring-primary/40 shadow-md shadow-primary/20"
                      : "chrome-btn-outline",
                  )}
                >
                  {h}h
                </button>
              ))}
            </div>
          </div>

          {/* For tier-less services (Livestream's Custom-Quote model),
              show the static highlights list as the What's Included
              overview — no tier picker to gate it. */}
          {!hasTiers && highlights && highlights.length > 0 && (
            <div className="rounded-lg border border-primary/30 bg-card/40 p-5 space-y-3">
              <p className="font-display text-[11px] uppercase tracking-[0.2em] text-primary font-semibold">
                What's Included
              </p>
              <ul className="space-y-2.5">
                {highlights.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 text-sm font-body text-foreground leading-relaxed"
                  >
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                    {/* min-w-0 + break-words — same flex min-width:auto overflow
                        guard as the tier list above (bug F1). */}
                    <span className="min-w-0 break-words">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
        </div>

        {/* Right column — order preview + Continue + trust line. Sticks to
            the viewport top on lg+ while the user scrolls through tier
            features and pickers. Flows below the form on mobile. */}
        <aside className="lg:sticky lg:top-20 lg:self-start space-y-4">

      {/* Your order — preview with backdrop image + tier + hours + exact
          total. Same amount that gets sent to Stripe Checkout, no fees
          added afterwards (we absorb processing). */}
      <div className="lg:pt-0 lg:border-t-0 pt-5 border-t border-border/30">
        <div className="rounded-lg border border-primary/30 bg-primary/5 overflow-hidden">
          <p className="font-display text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold px-5 pt-5 pb-3">
            Your order
          </p>
          <div className="px-5 pb-5 flex items-stretch gap-4">
            {/* Backdrop thumbnail */}
            {(() => {
              const selectedBackdrop = value.backdrop
                ? backdrops?.find((b) => b.name === value.backdrop)
                : null;
              const src = selectedBackdrop
                ? selectedBackdrop.image_url ||
                  FALLBACK_IMAGES[selectedBackdrop.name] ||
                  FALLBACK_IMAGES[`${selectedBackdrop.name} Backdrop`]
                : null;
              return (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-md overflow-hidden border border-border/40 bg-muted shrink-0">
                  {src ? (
                    <img
                      src={src}
                      alt={value.backdrop ?? ""}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[9px] text-muted-foreground font-body text-center px-1">
                      No backdrop yet
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Order details */}
            <div className="flex-1 min-w-0 flex flex-col justify-between gap-1.5 py-0.5">
              <div className="space-y-1">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="font-display text-[9px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Backdrop</span>
                  <span className="text-sm font-display font-bold text-foreground truncate">
                    {value.backdrop ?? "—"}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="font-display text-[9px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Tier</span>
                  <span className="text-sm font-display font-bold text-foreground truncate">
                    {selectedTier?.label ?? "—"}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="font-display text-[9px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Duration</span>
                  <span className="text-sm font-display font-bold text-foreground">
                    {value.hours}h
                  </span>
                </div>
                {sessionWindow && (
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="font-display text-[9px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Session</span>
                    <span className="text-sm font-display font-bold text-foreground truncate">
                      {sessionWindow}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Total */}
            <div className="text-right flex flex-col justify-between py-0.5">
              <p className="font-display text-[9px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                Total
              </p>
              <p className="text-2xl sm:text-3xl font-display font-bold chrome-text leading-none">
                {priceLabel}
              </p>
              <p className="text-[9px] font-body text-muted-foreground/80 leading-tight">
                Total at checkout.<br />No hidden fees.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleContinue}
          className="chrome-btn font-display font-semibold text-xs uppercase tracking-[0.2em] px-10 py-3 rounded-md inline-flex items-center gap-2"
        >
          Continue to Book
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
        <p className="text-[10px] font-body text-muted-foreground text-center max-w-sm leading-relaxed">
          Cancel up to 24h before · Secure Stripe payment · ID verified at booking · No charge until you confirm
        </p>
      </div>
        </aside>
      </div>

    </div>
  );
});

InlineBookingForm.displayName = "InlineBookingForm";

export default InlineBookingForm;
