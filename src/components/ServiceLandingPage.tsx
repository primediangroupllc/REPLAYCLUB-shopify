import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, MapPin, Maximize2, X } from "lucide-react";
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
import logo from "@/assets/logo.png";
import BrandLogo from "@/components/BrandLogo";
import OptimizedImage from "@/components/OptimizedImage";
import { trackViewContent } from "@/lib/metaPixel";
import { supabase } from "@/integrations/supabase/client";
import { useBookingTabImages, useBookingTabLayout } from "@/hooks/useBookingTabImages";
import { FALLBACK_IMAGES } from "@/hooks/useBackdrops";
import type { BookingTabType } from "@/lib/bookingTabImages";
import { BookingTabImagesRenderer } from "@/components/BookingTabImageLayouts";
import InlineBookingForm, {
  type InlineBookingFormState,
  type InlineBookingFormHandle,
} from "@/components/InlineBookingForm";
import BookingModal from "@/components/BookingModal";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";

interface ServiceTier {
  label: string;
  price: string;
  features: string[];
}

interface ServiceFAQ {
  question: string;
  answer: string;
}

export interface ServiceLandingProps {
  slug: string;
  title: string;
  headline: string;
  description: string;
  metaTitle: string;
  metaDescription: string;
  heroImage: string;
  heroImageStyle?: React.CSSProperties;
  /**
   * Admin-uploaded hero image URL. When provided, overrides the bundled
   * `heroImage` import. Falls back to `heroImage` when null/empty.
   */
  dbHeroUrl?: string | null;
  /** When set, pulls active images from `booking_tab_images` for this type. */
  bookingType?: BookingTabType;
  tiers: ServiceTier[];
  highlights: string[];
  faqs: ServiceFAQ[];
  ctaLabel?: string;
  onBook: () => void;
  customSection?: React.ReactNode;
  /**
   * Studio layouts / room configurations (admin-editable via Studio Config).
   * Rendered as a photo gallery section between highlights and customSection
   * when provided. Items without `image_url` show a muted placeholder.
   */
  setupsGallery?: Array<{
    id?: string;
    name: string;
    description?: string;
    image_url?: string;
  }>;
  /**
   * Optional title override for the setupsGallery section. Defaults to
   * "Studio Setups". Useful for service-specific labels.
   */
  setupsTitle?: string;
  /**
   * Add-ons rendered as a photo gallery (admin-editable via Studio Config).
   * Same shape as `setupsGallery`. Shown below the setups section.
   */
  addonsGallery?: Array<{
    id?: string;
    name: string;
    description?: string;
    image_url?: string;
  }>;
  /**
   * Opt-in: BOOK button expands an inline date/time/tier picker below the hero
   * instead of jumping to the homepage modal. Continue inside the form
   * still routes to /?book=<bookingSlug> with prefill so the modal handles
   * Verify/ID/Consent/Pay.
   */
  useInlineForm?: boolean;
  /**
   * Booking deep-link slug (e.g. "dj" → /?book=dj). Required when
   * `useInlineForm` is true. Distinct from `slug` (URL path slug).
   */
  bookingSlug?: string;
  /**
   * Opt-in (Stage 2+ — dormant until a page sets it): render the full booking
   * flow — Verify/ID/Consent/Pay — inline on this page via
   * <BookingModal variant="inline" />, instead of handing off to the popup
   * modal on the homepage. Requires `useInlineForm`.
   */
  inlineFullFlow?: boolean;
}

const ServiceLandingPage = ({
  slug,
  title,
  headline,
  description,
  metaTitle,
  metaDescription,
  heroImage,
  heroImageStyle,
  dbHeroUrl,
  bookingType,
  tiers,
  highlights,
  faqs,
  ctaLabel = "Book Now",
  onBook,
  customSection,
  setupsGallery,
  setupsTitle = "Studio Setups",
  addonsGallery,
  useInlineForm = false,
  bookingSlug,
  inlineFullFlow = false,
}: ServiceLandingProps) => {
  // When useInlineForm is on, the calendar/tier/duration form is rendered
  // unconditionally — the entire landing page IS the booking flow. The hero
  // BOOK button just scrolls to the form, and selecting a backdrop nudges
  // the user toward the calendar.
  const navigate = useNavigate();
  const inlineFormRef = useRef<HTMLDivElement>(null);
  const inlineFormHandleRef = useRef<InlineBookingFormHandle>(null);
  const backdropSectionRef = useRef<HTMLElement>(null);
  const [bookingState, setBookingState] = useState<InlineBookingFormState>({ hours: 2 });
  // Stage 3 (D): resume state for the inline flow after the Stripe Identity
  // round-trip. `resumeBookingId` is the existing draft to reuse; `resumeStep`
  // is the step the inline BookingModal opens on.
  const [resumeBookingId, setResumeBookingId] = useState<string | null>(null);
  const [resumeStep, setResumeStep] = useState<string | undefined>(undefined);
  // Name/phone from the resumed booking → seed the inline modal so the Consent
  // gate (needs name.trim()) passes for a fresh guest after the Stripe round-trip.
  const [resumeName, setResumeName] = useState<string | undefined>(undefined);
  const [resumePhone, setResumePhone] = useState<string | undefined>(undefined);
  const [searchParams] = useSearchParams();
  // Stage 4: the inline BookingModal renders once the user finishes the picks
  // (or returns mid-flow to resume). Until then only the picker shows.
  const [inlineFlowStarted, setInlineFlowStarted] = useState(false);
  const inlineModalRef = useRef<HTMLDivElement>(null);
  const [backdropPreviewIdx, setBackdropPreviewIdx] = useState<number | null>(null);
  const [restartDialogOpen, setRestartDialogOpen] = useState(false);
  // True when the user has started filling out the booking. Clicking the
  // logo with an in-progress booking should ask Continue/Restart first.
  const hasBookingProgress =
    !!bookingState.date ||
    !!bookingState.time ||
    !!bookingState.backdrop ||
    bookingState.tierIdx !== undefined;
  const handleLogoClick = (e: React.MouseEvent) => {
    if (useInlineForm && hasBookingProgress) {
      e.preventDefault();
      setRestartDialogOpen(true);
    }
    // Otherwise the <Link> handles the / navigation natively.
  };
  const handleMissingBackdrop = () => {
    requestAnimationFrame(() => {
      backdropSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };
  const scrollToForm = () => {
    requestAnimationFrame(() => {
      inlineFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };
  // Stage 4: the inline form's "Continue" hands off here — reveal the in-page
  // BookingModal (verify → consent → pay). The inlineFlowStarted effect below
  // handles the scroll once the collapsed layout has committed.
  const handleInlineContinue = () => {
    setInlineFlowStarted(true);
  };
  // Scroll to the inline modal AFTER the Option A collapse commits. Both the
  // forward flow (Continue) and the Stripe Identity resume set
  // inlineFlowStarted, which unmounts the hero/backdrops/picker — so a scroll
  // scheduled alongside the setState races the unmount (the resume path used
  // to target inlineFormRef, whose ref is nulled by the collapse → silent
  // no-op → the viewport just stayed wherever the SPA navigation left it).
  // An effect keyed on inlineFlowStarted runs post-commit, when the modal is
  // guaranteed mounted in its final, collapsed position.
  useEffect(() => {
    if (!inlineFlowStarted) return;
    requestAnimationFrame(() => {
      inlineModalRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [inlineFlowStarted]);
  // Tier strings for the inline BookingModal. MUST match room.tiers exactly —
  // the modal resolves initialTierLabel via room.tiers.includes(), so both
  // sides have to use the identical "price — label" string.
  const inlineTierStrings = tiers.map((t) =>
    t.price ? `${t.price} — ${t.label}` : t.label,
  );
  const handleBookClick = () => {
    if (useInlineForm) {
      scrollToForm();
      return;
    }
    onBook();
  };

  // Stage 3 (D): resume the inline booking flow after the Stripe Identity
  // round-trip. BookingReturn sends the user back here as
  // /<page>?resume=<bookingId> (+ optional &slot_taken / &id_cancelled /
  // &payment_cancelled / &id_stuck). We re-hydrate the picks and hand the
  // existing draft to the inline BookingModal at the right step.
  useEffect(() => {
    if (!inlineFullFlow) return;
    const resumeId = searchParams.get("resume");
    if (!resumeId) return;
    const slotTaken = searchParams.get("slot_taken") === "1";
    const paymentCancelled = searchParams.get("payment_cancelled") === "1";
    const idCancelled = searchParams.get("id_cancelled") === "1";
    const idStuck = searchParams.get("id_stuck") === "1";
    let cancelled = false;
    (async () => {
      const { data: booking, error } = await supabase
        .from("bookings")
        .select("id, booking_date, booking_time, tier, backdrop, verification_status, customer_name, customer_phone")
        .eq("id", resumeId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !booking) {
        toast.error("We couldn't find that booking. Please start a new one.");
        return;
      }
      // payment_cancelled / id_cancelled / id_stuck skip the "approved" gate:
      // the user is either verified and retrying checkout, or bailed out of
      // Stripe Identity and wants to retry.
      if (
        booking.verification_status !== "approved" &&
        !paymentCancelled &&
        !idCancelled &&
        !idStuck
      ) {
        toast.error("Verification isn't complete yet. Please try again.");
        return;
      }
      // Re-hydrate the picks so the form mirrors the in-progress booking.
      const next: InlineBookingFormState = { ...bookingState };
      if (booking.booking_date) {
        const [y, m, d] = String(booking.booking_date).split("-").map(Number);
        if (y && m && d) next.date = new Date(y, m - 1, d, 12, 0, 0, 0);
      }
      if (booking.booking_time) next.time = booking.booking_time;
      if (booking.tier) {
        const idx = tiers.findIndex(
          (t) => `${t.price} — ${t.label}` === booking.tier || t.label === booking.tier,
        );
        if (idx >= 0) next.tierIdx = idx;
      }
      if (booking.backdrop) next.backdrop = booking.backdrop;
      setBookingState(next);
      if (booking.customer_name) setResumeName(booking.customer_name);
      if (booking.customer_phone) setResumePhone(booking.customer_phone);
      setInlineFlowStarted(true);
      // Only treat as an approved resume (skip into the back half) when
      // verification really is approved.
      if (booking.verification_status === "approved") setResumeBookingId(resumeId);
      setResumeStep(
        slotTaken || idStuck
          ? "When"
          : paymentCancelled
            ? "Pay"
            : idCancelled
              ? "VerifyStripe"
              : "Consent",
      );
      if (slotTaken) {
        toast.error(
          "Your time slot is no longer available — please pick another. Your ID verification has been saved.",
          { duration: 8000 },
        );
      } else if (idStuck) {
        toast.error(
          "ID verification didn't go through. Please pick a fresh time and try again.",
          { duration: 8000 },
        );
      } else if (paymentCancelled) {
        toast("Payment cancelled — your slot is held while you decide.", { duration: 7000 });
      } else if (idCancelled) {
        toast("ID verification was cancelled. Tap below to try again.", { duration: 7000 });
      }
      // Strip the resume params so a refresh doesn't re-trigger the flow.
      const stripped = new URLSearchParams(searchParams);
      ["resume", "slot_taken", "payment_cancelled", "id_cancelled", "id_stuck"].forEach(
        (k) => stripped.delete(k),
      );
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${stripped.toString() ? `?${stripped}` : ""}`,
      );
      // Scroll is handled by the inlineFlowStarted effect above — it must run
      // after the collapse commits, not from inside this async callback.
    })();
    return () => {
      cancelled = true;
    };
    // Mount-only: the resume params are read once when the user lands back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Pick a backdrop → set it on state AND scroll the user to the calendar.
  // Clicking a backdrop is the strongest signal of intent; the next thing
  // they need to commit is a date/time.
  // Compute the running price for the sticky mobile CTA. Same parser shape
  // as InlineBookingForm so the bar matches the in-form total.
  const stickyPriceLabel = (() => {
    const tier = bookingState.tierIdx !== undefined ? tiers[bookingState.tierIdx] : undefined;
    if (!tier) return null;
    const hourly = tier.price.match(/\$(\d+(?:\.\d{1,2})?)/);
    const flat = tier.price.match(/\+\s*\$(\d+(?:\.\d{1,2})?)\s*flat/i);
    const hourlyCents = hourly ? Math.round(parseFloat(hourly[1]) * 100) : 0;
    const flatCents = flat ? Math.round(parseFloat(flat[1]) * 100) : 0;
    const total = hourlyCents * bookingState.hours + flatCents;
    if (total <= 0) return null;
    return `$${(total / 100).toFixed(0)}`;
  })();
  const handleBackdropSelect = (name: string) => {
    setBookingState({ ...bookingState, backdrop: name });
    if (useInlineForm) scrollToForm();
  };
  // What's Included is tier-driven. When a tier is picked, show ONLY that
  // tier's `features` array (admin-editable via studio_configurations) —
  // those are the items literally included at that price point. When no
  // tier picked, the static `highlights` list shows everything offered
  // across all tiers as an overview.
  const selectedTierIdx = bookingState.tierIdx;
  const includedItems: string[] =
    selectedTierIdx !== undefined && tiers[selectedTierIdx]?.features?.length
      ? tiers[selectedTierIdx].features
      : highlights;
  const includedTitle =
    selectedTierIdx !== undefined
      ? `What's Included with ${tiers[selectedTierIdx]?.label}`
      : "What's Included";
  // Admin-editable global hero accent hue. DB-first with hardcoded fallback —
  // if the fetch fails or no value is set, the hero renders unchanged.
  const [heroHue, setHeroHue] = useState<string | null>(null);
  // Only query when a booking type is provided; pages without one
  // (Livestream, Music) keep their hardcoded image untouched.
  const queryType = (bookingType ?? "dj_session") as BookingTabType;
  const { data: dbImages } = useBookingTabImages(queryType, true);
  const { data: layoutVariant } = useBookingTabLayout(queryType);
  const tabImages = bookingType ? dbImages ?? [] : [];
  const useDbLayout = bookingType ? tabImages.length > 0 : false;
  const variant = layoutVariant ?? "gallery";
  useEffect(() => {
    let cancelled = false;
    supabase
      .from("site_settings")
      .select("studio_hero_hue")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data?.studio_hero_hue) setHeroHue(data.studio_hero_hue);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.title = metaTitle;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", metaDescription);
    else {
      const meta = document.createElement("meta");
      meta.name = "description";
      meta.content = metaDescription;
      document.head.appendChild(meta);
    }

    // JSON-LD structured data
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Service",
      name: title,
      description: metaDescription,
      provider: {
        "@type": "LocalBusiness",
        name: "Replay Club",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Los Angeles",
          addressRegion: "CA",
        },
      },
      url: `https://www.replayclub.io/${slug}`,
    };
    let script = document.getElementById("seo-jsonld") as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = "seo-jsonld";
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(jsonLd);

    // Meta Pixel: ViewContent on every service landing page (DJ, Podcast, Recording, Backdrop, etc.)
    trackViewContent({ contentName: title, contentCategory: slug });

    return () => {
      document.title = "Replay Club — Recording Studio, Podcast & DJ Booking";
      script?.remove();
    };
  }, [metaTitle, metaDescription, title, slug]);

  return (
    <div
      className={cn(
        "min-h-screen bg-background text-foreground",
        // Bottom padding on mobile so the sticky CTA bar doesn't hide
        // the last bit of content (FAQ / location section). The bar (and
        // this clearance) goes away with the inline back-half collapse.
        useInlineForm && !inlineFlowStarted && "pb-24 md:pb-0",
      )}
    >
      {/* Simple nav — logo centered, no flanking text. Logo click goes home,
          BUT if the user has started filling out a booking we confirm first. */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center px-4 py-3 bg-background/80 backdrop-blur-md border-b border-border/20">
        <Link
          to="/"
          onClick={handleLogoClick}
          className="inline-flex items-center"
          aria-label="Back to Replay Club home"
        >
          <BrandLogo className="w-14 h-14 sm:w-16 sm:h-16" />
        </Link>
      </nav>

      {/* Option A (2026-06-09): during the inline back-half (inlineFlowStarted),
          hide the hero / backdrops / picker so the active modal step (consent/pay)
          lands at the top of the page — the inline modal renders its own booking
          summary, so no context is lost. The full landing layout returns whenever
          the inline flow hasn't started. */}
      {!inlineFlowStarted && (
      <>
      {useDbLayout ? (
        <>
          {/* Top spacer so content clears the fixed nav */}
          <div className="h-16" />
          <BookingTabImagesRenderer
            variant={variant}
            images={tabImages}
            alt={title}
            heroStyle={heroImageStyle}
          />
          {/* Headline + CTA below DB-driven layout. The H1 uses `title` (the
              admin-editable booking-tabs-meta name) so the page matches the
              orbit + the home selector tabs. The longer hardcoded `headline`
              becomes the supporting tagline. */}
          <section className="px-6 pt-10 pb-2 text-center">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-[10px] font-body uppercase tracking-[0.25em] text-muted-foreground mb-3"
            >
              Replay Club
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-h1 chrome-text mb-2"
            >
              {title}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="font-display text-sm uppercase tracking-[0.2em] text-muted-foreground mb-4"
            >
              {headline}
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-sm md:text-base font-body text-muted-foreground max-w-xl mx-auto leading-relaxed"
            >
              {description}
            </motion.p>
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              onClick={handleBookClick}
              className="mt-7 chrome-btn font-display font-semibold text-xs uppercase tracking-[0.2em] px-9 py-3 rounded-md"
            >
              {ctaLabel}
            </motion.button>
          </section>
        </>
      ) : (
        /* Hardcoded-image fallback hero (Phase 1 fallback path) */
        <section className="relative h-[60vh] min-h-[400px] overflow-hidden">
          <OptimizedImage
            src={dbHeroUrl || heroImage}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover opacity-50"
            style={heroImageStyle}
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent pointer-events-none" />
          {heroHue && (
            <div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none mix-blend-screen"
              style={{
                background: `radial-gradient(ellipse at 50% 35%, ${heroHue} 0%, transparent 70%)`,
                opacity: 0.7,
              }}
            />
          )}
          <div className="relative z-10 flex flex-col items-center justify-end h-full pb-12 px-6 text-center">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-[10px] font-body uppercase tracking-[0.25em] text-muted-foreground mb-3"
            >
              Replay Club
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-h1 chrome-text mb-2"
            >
              {title}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="font-display text-sm uppercase tracking-[0.2em] text-muted-foreground mb-4"
            >
              {headline}
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-sm md:text-base font-body text-muted-foreground max-w-xl leading-relaxed"
            >
              {description}
            </motion.p>
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              onClick={handleBookClick}
              className="mt-6 chrome-btn font-display font-semibold text-xs uppercase tracking-[0.15em] px-8 py-3 rounded-md"
            >
              {ctaLabel}
            </motion.button>
          </div>
        </section>
      )}

      {/* Backdrops / Setups gallery — moved up so it's the first content
          section after the hero. Always visible, with titles. Selectable +
          zoomable when the booking form is in flight. */}
      {setupsGallery && setupsGallery.length > 0 && (
        <section ref={backdropSectionRef} className="py-12 px-6 bg-card/10">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-h2 text-foreground mb-2 text-center">{setupsTitle}</h2>
            {useInlineForm && (
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-body text-center mb-6">
                Tap to select for your booking — tap the magnifier to preview full size
              </p>
            )}
            {!useInlineForm && <div className="mb-6" />}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {setupsGallery.map((s, i) => {
                const effectiveSrc =
                  s.image_url ||
                  FALLBACK_IMAGES[s.name] ||
                  FALLBACK_IMAGES[`${s.name} Backdrop`];
                const isSelected = bookingState.backdrop === s.name;
                const selectable = useInlineForm;
                return (
                  <motion.div
                    key={s.id || s.name || i}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    className={cn(
                      "relative rounded-lg overflow-hidden border-2 bg-card/40 transition-all duration-200",
                      isSelected
                        ? "border-primary ring-4 ring-primary/40 scale-[1.03] shadow-lg shadow-primary/30"
                        : "border-border/30",
                      selectable && !isSelected && "hover:border-border/60 hover:scale-[1.01]",
                    )}
                  >
                    {selectable ? (
                      <button
                        type="button"
                        onClick={() => handleBackdropSelect(s.name)}
                        aria-pressed={isSelected}
                        aria-label={`Select ${s.name}`}
                        className="block w-full text-left"
                      >
                        <div className="relative w-full aspect-[4/3] bg-muted">
                          {effectiveSrc ? (
                            <img
                              src={effectiveSrc}
                              alt={s.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground font-body">
                              No photo yet
                            </div>
                          )}
                          {isSelected && (
                            <div className="absolute top-2 left-2 bg-primary text-primary-foreground rounded-full p-1.5">
                              <CheckCircle2 className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                        <div className="p-4">
                          <p className="font-display text-sm font-semibold text-foreground">{s.name}</p>
                          {s.description && (
                            <p className="text-xs text-muted-foreground font-body mt-1 leading-relaxed">{s.description}</p>
                          )}
                        </div>
                      </button>
                    ) : (
                      <>
                        <div className="relative w-full aspect-[4/3] bg-muted">
                          {effectiveSrc ? (
                            <img
                              src={effectiveSrc}
                              alt={s.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground font-body">
                              No photo yet
                            </div>
                          )}
                        </div>
                        <div className="p-4">
                          <p className="font-display text-sm font-semibold text-foreground">{s.name}</p>
                          {s.description && (
                            <p className="text-xs text-muted-foreground font-body mt-1 leading-relaxed">{s.description}</p>
                          )}
                        </div>
                      </>
                    )}
                    {effectiveSrc && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setBackdropPreviewIdx(i);
                        }}
                        aria-label={`Preview ${s.name} full size`}
                        title={`Preview ${s.name} full size`}
                        className="absolute top-2 right-2 bg-background/85 hover:bg-background text-foreground rounded-md p-2 sm:p-1.5 transition-colors backdrop-blur-sm"
                      >
                        <Maximize2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Inline booking form — rendered unconditionally when useInlineForm is
          on. The page is the booking flow; the BOOK button just scrolls
          here. Continue hands off to the modal at the Customize step with
          all picks prefilled. */}
      {useInlineForm && (
        <section className="px-3 sm:px-6 pb-6" ref={inlineFormRef}>
          <div className="max-w-5xl mx-auto">
            <InlineBookingForm
              ref={inlineFormHandleRef}
              slug={bookingSlug || slug}
              roomTitle={title}
              tiers={tiers}
              value={bookingState}
              onChange={setBookingState}
              requireBackdrop={!!setupsGallery && setupsGallery.length > 0}
              onMissingBackdrop={handleMissingBackdrop}
              highlights={highlights}
              backdrops={setupsGallery}
              onInlineContinue={inlineFullFlow ? handleInlineContinue : undefined}
            />
          </div>
        </section>
      )}
      </>
      )}

      {/* Stage 2 scaffolding (DORMANT): when `inlineFullFlow` is set, the full
          booking flow — Verify/ID/Consent/Pay — renders inline here via
          BookingModal's "inline" variant, instead of the /?book= hand-off to
          the popup modal. No page sets `inlineFullFlow` yet, so this is dead
          code in production until Stage 4 flips DJ. The room/initial* mapping
          is finalized when DJ is flipped. */}
      {useInlineForm && inlineFullFlow && inlineFlowStarted && (
        // pt-24 clears the fixed nav (~73px mobile / ~81px desktop: py-3 +
        // h-12/sm:h-14 logo + border) — the h-16 spacer lives inside the
        // hidden !inlineFlowStarted block, so the collapsed layout needs its own.
        <div className="px-6 pt-24 pb-10" ref={inlineModalRef}>
          <div className="max-w-5xl mx-auto">
            <BookingModal
              variant="inline"
              open
              onOpenChange={() => {}}
              room={{
                title,
                price: tiers[0]?.price ?? "",
                tiers: inlineTierStrings,
              }}
              initialDate={
                bookingState.date ? format(bookingState.date, "yyyy-MM-dd") : undefined
              }
              initialTime={bookingState.time}
              initialTierLabel={
                bookingState.tierIdx !== undefined
                  ? inlineTierStrings[bookingState.tierIdx]
                  : undefined
              }
              initialBackdrop={bookingState.backdrop}
              initialHours={bookingState.hours}
              initialName={resumeName}
              initialPhone={resumePhone}
              initialStep={resumeStep ?? "VerifyStripe"}
              resumeBookingId={resumeBookingId}
            />
          </div>
        </div>
      )}

      {/* What's Included — when useInlineForm is on, this lives INSIDE the
          form (under the tier picker). Render this standalone section only
          for landing pages that don't use the inline form. */}
      {!useInlineForm && (
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-h2 text-foreground mb-8 text-center">
            {includedTitle}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {includedItems.map((h, i) => (
              <motion.div
                key={`${selectedTierIdx ?? "all"}-${i}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-start gap-3 p-4 rounded-lg border border-primary/30 bg-card/30"
              >
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                <span className="text-sm font-body text-foreground">{h}</span>
              </motion.div>
            ))}
          </div>
          {selectedTierIdx === undefined && tiers.length > 0 && (
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-body text-center mt-6">
              Pick a tier in the form above to see exactly what's in your booking
            </p>
          )}
        </div>
      </section>
      )}

      {/* Backdrop lightbox — full-size preview triggered from the gallery's
          magnifier icon. Esc / click-outside / X to close. Prev / Next to
          flip through. */}
      <AnimatePresence>
        {backdropPreviewIdx !== null && setupsGallery && setupsGallery[backdropPreviewIdx] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setBackdropPreviewIdx(null)}
            className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-4 cursor-zoom-out"
            onKeyDown={(e) => {
              if (e.key === "Escape") setBackdropPreviewIdx(null);
            }}
            tabIndex={-1}
            role="dialog"
            aria-label="Backdrop preview"
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setBackdropPreviewIdx(null);
              }}
              aria-label="Close preview"
              className="absolute top-4 right-4 bg-background/80 hover:bg-background text-foreground rounded-full p-2 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            {(() => {
              const s = setupsGallery[backdropPreviewIdx];
              const src =
                s.image_url ||
                FALLBACK_IMAGES[s.name] ||
                FALLBACK_IMAGES[`${s.name} Backdrop`];
              const isSelected = bookingState.backdrop === s.name;
              return (
                <motion.div
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.95 }}
                  onClick={(e) => e.stopPropagation()}
                  className="max-w-4xl w-full flex flex-col items-center gap-4 cursor-default"
                >
                  {src && (
                    <img
                      src={src}
                      alt={s.name}
                      className="max-h-[75vh] w-auto object-contain rounded-lg shadow-2xl"
                    />
                  )}
                  <div className="flex items-center justify-center gap-3 flex-wrap">
                    <p className="font-display text-lg font-bold text-foreground">{s.name}</p>
                    {useInlineForm && (
                      <button
                        type="button"
                        onClick={() => {
                          setBookingState({ ...bookingState, backdrop: s.name });
                          setBackdropPreviewIdx(null);
                        }}
                        className={cn(
                          "font-display font-semibold text-xs uppercase tracking-[0.15em] px-4 py-2 rounded-md inline-flex items-center gap-2",
                          isSelected
                            ? "bg-primary/20 text-primary cursor-default"
                            : "chrome-btn",
                        )}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {isSelected ? "Selected" : "Use this backdrop"}
                      </button>
                    )}
                  </div>
                  {setupsGallery.length > 1 && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setBackdropPreviewIdx((cur) =>
                            cur === null
                              ? 0
                              : (cur - 1 + setupsGallery.length) % setupsGallery.length,
                          )
                        }
                        className="chrome-btn-outline font-display text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-md"
                      >
                        ← Prev
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setBackdropPreviewIdx((cur) =>
                            cur === null ? 0 : (cur + 1) % setupsGallery.length,
                          )
                        }
                        className="chrome-btn-outline font-display text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-md"
                      >
                        Next →
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add-ons gallery — informational, hidden when the inline form is open. */}
      {addonsGallery && addonsGallery.length > 0 && !useInlineForm && (
        <section className="py-16 px-6">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-h2 text-foreground mb-8 text-center">Add-ons</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {addonsGallery.map((a, i) => {
                const effectiveSrc =
                  a.image_url ||
                  FALLBACK_IMAGES[a.name] ||
                  FALLBACK_IMAGES[`${a.name} Backdrop`];
                return (
                  <motion.div
                    key={a.id || a.name || i}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-lg overflow-hidden border border-border/30 bg-card/40"
                  >
                    <div className="relative w-full aspect-[4/3] bg-muted">
                      {effectiveSrc ? (
                        <img
                          src={effectiveSrc}
                          alt={a.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground font-body">
                          No photo yet
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <p className="font-display text-sm font-semibold text-foreground">{a.name}</p>
                      {a.description && (
                        <p className="text-xs text-muted-foreground font-body mt-1 leading-relaxed">{a.description}</p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Pricing Tiers — informational. When the inline form is open the
          tier picker inside the form is the canonical surface; hide this
          duplicate to avoid two pricing displays on the same page. */}
      {/* Option A: the page tail (customSection / pricing / FAQ / location)
          collapses with the rest of the landing layout during the inline
          back-half — the modal is the only content on screen. */}
      {!inlineFlowStarted && (
      <>
      {customSection}
      {tiers.length > 0 && !useInlineForm && (
        <section className="py-16 px-6 bg-card/20">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-h2 text-foreground mb-8 text-center">
              Pricing
            </h2>
            <div className={`grid gap-6 ${tiers.length === 1 ? "max-w-md mx-auto" : tiers.length === 2 ? "grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto" : "grid-cols-1 sm:grid-cols-3"}`}>
              {tiers.map((tier, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="chrome-surface rounded-lg p-6 border border-border/30 text-center"
                >
                  <h3 className="font-display text-sm font-bold text-foreground uppercase tracking-wider mb-2">
                    {tier.label}
                  </h3>
                  <p className="font-display text-2xl font-bold chrome-text mb-4">{tier.price}</p>
                  <ul className="space-y-2">
                    {tier.features.map((f, j) => (
                      <li key={j} className="text-xs font-body text-muted-foreground flex items-center gap-2">
                        <span className="w-px h-3 bg-chrome-dark" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      {faqs.length > 0 && (
        <section className="py-16 px-6">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-h2 text-foreground mb-8 text-center">
              Frequently Asked Questions
            </h2>
            <div className="space-y-4">
              {faqs.map((faq, i) => (
                <motion.details
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="group rounded-lg border border-border/30 bg-card/30 overflow-hidden"
                >
                  <summary className="cursor-pointer px-5 py-4 font-display text-sm font-semibold text-foreground list-none flex items-center justify-between">
                    {faq.question}
                    <span className="text-muted-foreground group-open:rotate-45 transition-transform duration-200 text-lg">+</span>
                  </summary>
                  <p className="px-5 pb-4 text-xs font-body text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </p>
                </motion.details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Location + CTA */}
      <section className="py-16 px-6 bg-card/20">
        <div className="max-w-xl mx-auto text-center">
          <MapPin className="w-5 h-5 text-primary mx-auto mb-3" />
          <p className="text-xs font-body text-muted-foreground uppercase tracking-widest mb-2">Located in</p>
          <p className="font-display text-lg font-bold text-foreground mb-6">Los Angeles, CA</p>
          <button
            onClick={handleBookClick}
            className="chrome-btn font-display font-semibold text-xs uppercase tracking-[0.15em] px-10 py-3 rounded-md"
          >
            {ctaLabel}
          </button>
        </div>
      </section>
      </>
      )}

      {/* Footer back link removed — single back button lives in the header. */}

      {/* Logo-click guard: when user has booking progress, ask before
          throwing it away by navigating home. */}
      <AlertDialog open={restartDialogOpen} onOpenChange={setRestartDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave your booking?</AlertDialogTitle>
            <AlertDialogDescription>
              You've already started filling out your booking. You can stay
              and keep going, or start over from the homepage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep going</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setBookingState({ hours: 2 });
                navigate("/");
              }}
            >
              Start over
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sticky mobile CTA — only on phones, only when the inline form is in
          play. Always-visible running total + Continue so users never lose
          sight of the booking destination. */}
      {useInlineForm && !inlineFlowStarted && (
        <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-md border-t border-border/40 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center justify-between gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
          <div className="min-w-0">
            <p className="text-[9px] font-display uppercase tracking-[0.2em] text-muted-foreground">
              {stickyPriceLabel ? "Estimated total" : "Your booking"}
            </p>
            <p className="font-display font-bold text-foreground truncate">
              {stickyPriceLabel ? (
                <span className="chrome-text text-lg">{stickyPriceLabel}</span>
              ) : (
                <span className="text-xs text-muted-foreground">Pick a tier to see total</span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => inlineFormHandleRef.current?.continue()}
            className="chrome-btn font-display font-semibold text-[11px] uppercase tracking-[0.2em] px-5 py-3 rounded-md shrink-0"
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
};

export default ServiceLandingPage;
