import { useState, useRef, useEffect, useMemo, lazy, Suspense } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Mail, User, ShoppingCart, X, Globe, Gift, Mic, Calendar, ShoppingBag, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { prefetchBookingBootstrap } from "@/lib/prefetchBookingBootstrap";
import { motion, AnimatePresence } from "framer-motion";
import { SessionSelections } from "@/components/CustomizeSession";
import logo from "@/assets/logo.png";
import HeroSection from "@/components/HeroSection";
import RoomCard from "@/components/RoomCard";
import ServiceSelector from "@/components/ServiceSelector";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import SiteFooter from "@/components/SiteFooter";
import SeoHead from "@/components/SeoHead";
import YouTubeFacade from "@/components/YouTubeFacade";
import { useFirstImagesByType } from "@/hooks/useBookingTabImages";
import { useBookingTabsMeta } from "@/hooks/useBookingTabsMeta";
import { useHomeCardsCustom } from "@/hooks/useHomeCardsCustom";
import type { BookingTabType } from "@/lib/bookingTabImages";
import { getProducts } from "@/lib/products";

const ROOM_TITLE_TO_TAB_TYPE: Record<string, BookingTabType | null> = {
  "Podcast": "podcast",
  "Disk Jockey": "dj_session",
  "Photoshoot": "backdrop",
  "Livestream": "livestream",
  "Equipment Rental": "equipment_rental",
  "Music": "music",
};

// Lazy-load BookingModal — it's a large component (~1,800 lines) and only needed
// once the user clicks "book". Keeping it out of the initial bundle saves ~100KB
// off the critical path. We prefetch on first interaction below.
const BookingModal = lazy(() => import("@/components/BookingModal"));

// Lazy-load below-fold sections to shorten critical request chain.
const loadCustomizeSession = () => import("@/components/CustomizeSession");
const CustomizeSession = lazy(loadCustomizeSession);

const EquipmentSection = lazy(() => import("@/components/EquipmentSection"));
const TalentRoster = lazy(() => import("@/components/TalentRoster"));
const BackdropsGallery = lazy(() => import("@/components/BackdropsGallery"));
const FAQSection = lazy(() => import("@/components/FAQSection"));
const TwitchLiveBanner = lazy(() => import("@/components/TwitchLiveBanner"));

// Import equipment data directly (small JSON, not worth lazy-loading)
import { equipment } from "@/components/EquipmentSection";
import { BACKDROPS } from "@/components/BackdropsGallery";
import { useAllStudioConfigs } from "@/hooks/useStudioConfig";
import type { StudioKey } from "@/lib/studioConfig";
import { usePublicSiteSettings, DEFAULT_ORBIT_NODES, type OrbitNode } from "@/hooks/useSiteSettings";
import {
  ROOM_EQUIPMENT_RENTAL,
  TAB_BACKDROPS,
  TAB_TALENT,
  PHOTO_PACKAGES,
  ADDON_BUNDLES,
} from "@/lib/bookingConstants";
import { tabToFaqTopic } from "@/lib/faqContent";
import { ChunkErrorBoundary, BookingChunkLoading } from "@/components/ChunkErrorBoundary";

// Unified cart lookup so equipment (daily), backdrops (hourly), photo packages
// (flat), and bundled add-ons (daily) all render correctly in the cart dropdown.
const cartLookup = (name: string) => {
  const eq = equipment.find(e => e.name === name);
  if (eq) return { name: eq.name, priceCents: eq.priceCents, unit: "day" as const };
  const bd = BACKDROPS.find(b => b.name === name);
  if (bd) return { name: bd.name, priceCents: bd.priceCents, unit: "hr" as const };
  const pkg = PHOTO_PACKAGES.find(p => p.name === name);
  if (pkg) return { name: pkg.name, priceCents: pkg.priceCents, unit: "flat" as const };
  const bundle = ADDON_BUNDLES.find(b => b.name === name);
  if (bundle) return { name: bundle.name, priceCents: bundle.priceCents, unit: "day" as const };
  return null;
};

import studioAImg from "@/assets/studio-a.jpg";
import podcastImg from "@/assets/podcast-room-new.jpg";
import djRoomImg from "@/assets/dj-room.webp";
import equipmentImg from "@/assets/equipment-rentals.webp";
import livestreamImg from "@/assets/livestream.jpg";
import musicStudioImg from "@/assets/music-studio.jpg";
import podcast1Img from "@/assets/podcast-1.jpg";
import podcast2Img from "@/assets/podcast-2.jpg";

const rooms = [
  {
    title: "Podcast",
    subtitle: "Audio & Video Recording",
    image: podcastImg,
    price: "$60/hr — 1 or 2 hour sessions",
    available: true,
    popular: false,
    imageStyle: { transform: 'scale(0.85)', objectPosition: 'center center' },
    minHours: 1,
    tiers: [
      "$60/hr — Audio only",
      "$85/hr — Audio + Video Recording",
      "$60/hr — Audio + Full Edit (+$150 flat)",
      "$85/hr — Audio + Video + Full Edit (+$150 flat)",
    ],
    minimum: "Minimum Booking: 1 hour ($60)",
    features: [
      "Professional Mic Setup",
      "Optional Multi-Cam Video (+$25/hr)",
      "Optional Full Audio Edit (+$150 flat)",
      "Acoustic-treated Room",
      "1- or 2-hour sessions",
    ],
    galleryImages: [podcast1Img, podcast2Img],
  },
  {
    title: "Disk Jockey",
    subtitle: "DJ Performance",
    image: djRoomImg,
    price: "Starting at $55/hr",
    available: true,
    popular: true,
    tiers: [
      "$55/hr — self-service",
      "$80/hr — lighting + setup",
      "$115/hr — with FX3 recording",
    ],
    minimum: "Minimum Booking: $110",
    features: [
      "AlphaTheta XDJ-AZ",
      "LED Lighting Rig",
      "Monitor Speakers",
      "2-hour minimum required",
    ],
  },
  {
    title: "Photoshoot",
    comingSoon: true,
    subtitle: "Photo & Content",
    image: studioAImg,
    price: "Starting at $70/hr",
    available: true,
    tiers: [
      "$70/hr — lighting + space",
      "$110/hr — camera included",
      "$165/hr — full content setup",
    ],
    minimum: "Minimum Booking: $140",
    features: [
      "Professional Lighting Setup",
      "Multiple Backdrop Options",
      "High-Res Camera Available",
      "2-hour minimum required",
    ],
  },
  {
    title: "Livestream",
    subtitle: "Pro / Broadcast",
    image: livestreamImg,
    imageStyle: { objectPosition: 'center 80%' },
    price: "",
    available: true,
    tiers: [],
    minimum: "",
    features: [
      "Multi-Camera Setup",
      "Professional Audio Mixing",
      "Real-Time Streaming",
    ],
  },
  {
    title: "Equipment Rental",
    subtitle: "Gear To Go",
    image: equipmentImg,
    price: "From $10 / day",
    available: true,
    tiers: [],
    minimum: "",
    features: [
      "AlphaTheta XDJ-AZ",
      "Sony FX3 Cinema Camera \n",
      "Sony C-800G Tube Mic",
      "Shure SM7B Dynamic Mic",
      "Neumann U87 Ai Condenser ",
      "Rodecaster Pro II Console",
      "Sennheiser HD 650 Headphones",
    ],
  },
  {
    title: "Music",
    subtitle: "Recording Studio",
    image: musicStudioImg,
    price: "Starting at $75/hr",
    available: true,
    tiers: [
      "$75/hr — Self-Serve",
      "$125/hr — Engineered",
      "$185/hr — Premium Production",
    ],
    minimum: "Minimum Booking: 2 hours ($150)",
    features: [
      "Tracking Room / Vocal Booth / Full Band layouts",
      "Engineer-led sessions available",
      "Vintage mic locker (U87, C800, BACH 195)",
      "Same-day rough mix delivery",
      "2-hour minimum required",
    ],
  },
];

const normalizeBookingSlug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const roomLandingRoutes: Record<string, string> = {
  Music: "/music-studio",
  Podcast: "/podcast",
  "Disk Jockey": "/dj",
  Photoshoot: "/photoshoot",
  Livestream: "/livestream-studio",
  "Equipment Rental": "/equipment-rental",
};

/**
 * Maps each booking-modal room title to the studio_configurations row that
 * holds its admin-editable tier features. Rooms without a config (Photoshoot,
 * Equipment Rental) get null and won't show tier-feature dropdowns.
 */
const roomToStudioKey: Record<string, StudioKey | null> = {
  Music: "music",
  Podcast: "podcast",
  "Disk Jockey": "dj",
  Photoshoot: null,
  Livestream: "livestream",
  "Equipment Rental": null,
};

/**
 * Parse "$55/hr — …" pattern from a tier string. Returns cents (e.g. 5500)
 * or null when the format doesn't match.
 */
const parseTierStringPrice = (s: string): number | null => {
  const m = s.match(/\$(\d+)\s*\/?\s*hr/i);
  return m ? parseInt(m[1], 10) * 100 : null;
};

const roomBookingAliases: Record<string, string[]> = {
  Podcast: ["podcast"],
  "Disk Jockey": ["dj", "dj-session", "djsession", "dj-set", "djset", "set"],
  Photoshoot: ["photoshoot", "photo-shoot", "photo"],
  Livestream: ["livestream", "live-stream"],
  "Equipment Rental": ["equipment-rental", "equipmentrental", "rental", "rentals"],
  // 'studio', 'studio-sesh', 'studiosesh' map here too — Studio Sesh was
  // merged into Music 2026-05-13.
  Music: ["music", "music-studio", "musicstudio", "recording", "recording-studio", "studio", "studio-sesh", "studiosesh", "studio-sesh-room"],
};

const stepAliasMap: Record<string, string> = {
  date: "Date",
  datetime: "Time",
  "date-time": "Time",
  time: "Time",
  tier: "Tier",
  package: "Tier",
  details: "Verify",
  verify: "Verify",
  verification: "Verify",
  id: "ID",
  consent: "Consent",
  pay: "Pay",
  payment: "Pay",
  checkout: "Pay",
};

const normalizeBookingStep = (value: string | null | undefined) => {
  if (!value) return undefined;
  const normalized = normalizeBookingSlug(value);
  return stepAliasMap[normalized];
};

const getBookableRoomFromSlug = (slug: string) => {
  const normalizedSlug = normalizeBookingSlug(slug);
  return rooms.find((room) => {
    if ((room as any).comingSoon) return false;
    const aliases = roomBookingAliases[room.title] || [];
    return [room.title, ...aliases].some((candidate) => normalizeBookingSlug(candidate) === normalizedSlug);
  });
};

const Index = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { settings: siteSettings } = usePublicSiteSettings();
  const [bookingOpen, setBookingOpen] = useState(false);
  const [initialBookingStep, setInitialBookingStep] = useState<string | undefined>(undefined);
  // Inline-booking-form prefill (set by /?date=...&time=...&tier_idx=... from
  // a service landing page's InlineBookingForm). Cleared when modal closes.
  const [bookingPrefillDate, setBookingPrefillDate] = useState<string | undefined>(undefined);
  const [bookingPrefillTime, setBookingPrefillTime] = useState<string | undefined>(undefined);
  const [bookingPrefillTier, setBookingPrefillTier] = useState<string | undefined>(undefined);
  const [bookingPrefillBackdrop, setBookingPrefillBackdrop] = useState<string | undefined>(undefined);
  // PR 4a — when set, BookingModal is in "resume" mode after a Stripe
  // Identity round-trip. The id flows into create-booking-payment as
  // existingBookingId so we update the existing draft instead of inserting.
  const [resumeBookingId, setResumeBookingId] = useState<string | null>(null);
  const [latestVideoId, setLatestVideoId] = useState<string>("RTyftA9g5vI");
  // PR — Booking-modal URL sync. We mirror the active step into the URL so
  // browser back/forward (and iOS swipe-back) navigate between modal steps
  // instead of escaping the modal entirely. Tracks the slug actively in the
  // URL so popstate can reopen the modal after a forward-then-back.
  const [activeBookingSlug, setActiveBookingSlug] = useState<string | null>(null);
  // True once the modal has reported its first step on the current open;
  // first report uses replaceState (so closing returns to the prior page),
  // subsequent reports pushState (so back maps to step navigation).
  const firstStepReportedRef = useRef(false);

  // TODO(shopify-smoke-test): Remove after confirming Storefront API is wired.
  useEffect(() => {
    getProducts(10)
      .then((p) => console.log("Shopify products:", p))
      .catch((e) => console.error("Shopify products error:", e));
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase.functions
      .invoke("get-latest-youtube-video")
      .then(({ data, error }) => {
        if (cancelled || error) return;
        if (data?.video_id) setLatestVideoId(data.video_id);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const [selectedRoom, setSelectedRoom] = useState<typeof rooms[0] | null>(null);
  // Admin-editable tier features pulled from studio_configurations.tiers.
  // Built lazily inside useMemo so we only rebuild when the selected room
  // or the configs change.
  const { configs: allStudioConfigs } = useAllStudioConfigs(0);
  const tierFeatures = useMemo<Record<string, string[]>>(() => {
    if (!selectedRoom?.tiers?.length) return {};
    const studioKey = roomToStudioKey[selectedRoom.title];
    if (!studioKey) return {};
    const config = allStudioConfigs.find((c) => c.studio_key === studioKey);
    if (!config?.tiers?.length) return {};
    const map: Record<string, string[]> = {};
    for (const tierString of selectedRoom.tiers) {
      const wantedPrice = parseTierStringPrice(tierString);
      const lowerString = tierString.toLowerCase();
      // Prefer a tier whose price matches AND whose label appears in the
      // tier string. Fall back to first price match if no label match.
      const matches = config.tiers.filter(
        (t) => wantedPrice !== null && t.price_cents_per_hour === wantedPrice,
      );
      const labelMatch = matches.find((t) => lowerString.includes(t.label.toLowerCase()));
      const chosen = labelMatch ?? matches[0];
      if (chosen?.features?.length) {
        map[tierString] = chosen.features;
      }
    }
    return map;
  }, [selectedRoom, allStudioConfigs]);
  const [selectedTab, setSelectedTab] = useState<string>(TAB_BACKDROPS);
  const [tabActivated, setTabActivated] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [cartItems, setCartItems] = useState<Set<string>>(new Set());
  const [cartOpen, setCartOpen] = useState(false);
  const [sessionSelections, setSessionSelections] = useState<{ lighting: string; sound: string; layout: string } | undefined>();
  const [bookingTransitioning, setBookingTransitioning] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  // Tracks whether the auth session has resolved at least once. Prevents the
  // ?book= deep-link effect from racing the async getSession() and bouncing
  // a logged-in user to /auth before we know they're signed in.
  const [authResolved, setAuthResolved] = useState(false);
  const navigate = useNavigate();
  const roomsRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { data: firstImagesByType = {} as Record<BookingTabType, string | null> } =
    useFirstImagesByType();
  const { data: metaData = [] } = useBookingTabsMeta();
  const { data: customCards = [] } = useHomeCardsCustom();

  // Admin-controlled service visibility. Hide rooms whose `is_active` is
  // false in studio_configurations from the homepage selector + tabs. The
  // map below mirrors ROOM_TO_STUDIO_KEY but is local to keep this hook
  // independent of the shared studioConfig module.
  const [inactiveTitles, setInactiveTitles] = useState<Set<string>>(new Set());
  useEffect(() => {
    let cancelled = false;
    supabase
      .from("studio_configurations")
      .select("studio_key, is_active")
      .then(({ data }) => {
        if (cancelled || !data) return;
        const titleByKey: Record<string, string> = {
          music: "Music",
          dj: "Disk Jockey",
          podcast: "Podcast",
          livestream: "Livestream",
        };
        const next = new Set<string>();
        for (const row of data as any[]) {
          if (row?.is_active === false && titleByKey[row.studio_key]) {
            next.add(titleByKey[row.studio_key]);
          }
        }
        setInactiveTitles(next);
      });
    return () => { cancelled = true; };
  }, []);

  const visibleRooms = useMemo(
    () => {
      // Fallback: if meta hasn't loaded yet, render hardcoded list with image
      // overrides only — never blank the page.
      if (!metaData || metaData.length === 0) {
        return rooms
          .filter((r) => !inactiveTitles.has(r.title))
          .map((room) => {
            const tabType = ROOM_TITLE_TO_TAB_TYPE[room.title];
            const dbImage = tabType ? firstImagesByType[tabType] : null;
            return dbImage ? { ...room, image: dbImage } : room;
          });
      }
      // Merge: drive order + editable fields from DB meta, keep
      // tiers/features/galleryImages/etc. from the hardcoded source.
      const fromMeta = metaData
        .map((meta) => {
          if (meta.is_hidden) return null;
          const hardcoded = rooms.find(
            (r) => ROOM_TITLE_TO_TAB_TYPE[r.title] === meta.booking_type,
          );
          if (!hardcoded) return null;
          if (inactiveTitles.has(hardcoded.title)) return null;
          const dbImage = firstImagesByType[meta.booking_type];
          return {
            ...hardcoded,
            title: meta.title,
            subtitle: meta.subtitle,
            price: meta.price,
            comingSoon: meta.coming_soon,
            image: dbImage ?? hardcoded.image,
            __displayOrder: meta.display_order,
          };
        })
        .filter(Boolean) as any[];
      // Admin-authored custom cards. Title uniqueness is the dedup key with
      // existing rooms — a custom card sharing a title with a fixed one wins
      // (admin override behavior).
      const fixedTitles = new Set(fromMeta.map((r) => r.title));
      const fromCustom = (customCards ?? [])
        .filter((c) => !c.is_hidden)
        .filter((c) => !fixedTitles.has(c.title))
        .map((c) => ({
          title: c.title,
          subtitle: c.subtitle,
          price: c.price,
          image: c.image_url || "",
          features: [] as string[],
          tiers: [] as any[],
          minimum: "",
          available: true,
          comingSoon: c.coming_soon,
          galleryImages: undefined,
          imageStyle: undefined,
          __displayOrder: c.display_order,
          __customRoute: c.route,
        }));
      return [...fromMeta, ...fromCustom].sort(
        (a, b) => (a.__displayOrder ?? 0) - (b.__displayOrder ?? 0),
      ) as typeof rooms;
    },
    [inactiveTitles, firstImagesByType, metaData, customCards],
  );

  // Warm the booking-bootstrap query AND the BookingModal JS chunk as soon
  // as the homepage settles. Data prefetch (~250–600ms cold) + chunk
  // download (~50–100KB) both finish before most users reach for the Book
  // CTA, so the modal opens with profile + loyalty + equipment in cache
  // and no Suspense gap. Without the chunk preload, the first click feels
  // broken: Dialog flips open → Suspense fallback={null} → user clicks
  // backdrop → Dialog closes → second click "works" because the chunk
  // arrived in between.
  useEffect(() => {
    const idle = (cb: () => void) =>
      typeof (window as any).requestIdleCallback === "function"
        ? (window as any).requestIdleCallback(cb, { timeout: 2000 })
        : window.setTimeout(cb, 800);
    const handle = idle(() => {
      prefetchBookingBootstrap(queryClient);
      import("@/components/BookingModal");
    });
    return () => {
      if (typeof (window as any).cancelIdleCallback === "function") {
        (window as any).cancelIdleCallback(handle);
      } else {
        window.clearTimeout(handle as unknown as number);
      }
    };
  }, [queryClient]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setIsLoggedIn(!!session);
      setAuthResolved(true);
      if (session?.user) {
        // Defer to avoid running queries inside the auth callback.
        setTimeout(async () => {
          const { data } = await supabase.rpc("has_role", {
            _user_id: session.user.id,
            _role: "admin" as const,
          });
          setIsAdmin(!!data);
        }, 0);
      } else {
        setIsAdmin(false);
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
      setAuthResolved(true);
      if (session?.user) {
        supabase
          .rpc("has_role", { _user_id: session.user.id, _role: "admin" as const })
          .then(({ data }) => setIsAdmin(!!data));
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Honor ?tab= query param (e.g. /?tab=Talent from the side menu) so the
  // talent roster section opens automatically on navigation.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get("tab");
    if (!tab) {
      // No ?tab= in the URL → user navigated to the bare homepage
      // (e.g. clicked "Home" in the side menu). Reset to the hero so
      // the orbit re-appears instead of staying stuck on a previously
      // activated tab.
      setTabActivated(false);
      setSelectedTab(TAB_BACKDROPS);
      return;
    }
    const normalizedTab = tab.toLowerCase() === "studios" ? TAB_BACKDROPS.toLowerCase() : tab;
    const validTabs = [TAB_BACKDROPS, ...visibleRooms.filter(r => !(r as any).comingSoon).map(r => r.title), TAB_TALENT];
    const match = validTabs.find(t => t.toLowerCase() === normalizedTab.toLowerCase());
    if (!match) return;
    if (tab.toLowerCase() === "studios") {
      params.set("tab", TAB_BACKDROPS);
      window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
    }
    setSelectedTab(match);
    setTabActivated(true);
    // Prevent the browser from restoring previous scroll, then jump directly
    // to the activated section so the user lands on the tab content (not the hero).
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    const jump = () => {
      const el = roomsRef.current;
      if (!el) return false;
      el.scrollIntoView({ behavior: "auto", block: "start" });
      return true;
    };
    // Try immediately (after section renders) and again after layout settles.
    requestAnimationFrame(() => {
      if (!jump()) setTimeout(jump, 50);
      setTimeout(jump, 200);
      setTimeout(jump, 500);
    });
    // Re-run whenever the search string changes so SPA navigation
    // (e.g. /?tab=DJ → /) correctly resets or re-activates the hero.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  // Honor ?book=<slug> query param (e.g. /?book=podcast from service landing pages)
  // so the booking customize flow opens automatically for that room.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const bookSlug = (location.state as { openBookingFor?: string } | null)?.openBookingFor || params.get("book");
    // Wait for auth state to resolve before deciding whether to open the
    // booking modal or bounce to /auth — otherwise we'd false-redirect a
    // logged-in user on the first render.
    if (!authResolved && (bookSlug || params.get("selector") === "1")) return;
    // PR 4a — resume entry from /booking/return after Stripe Identity.
    // /?book=resume&booking=<id> → fetch booking row, find matching room,
    // open modal pre-populated, land on Consent step.
    if (bookSlug === "resume") {
      const resumeId = params.get("booking");
      const slotTaken = params.get("slot_taken") === "1";
      const paymentCancelled = params.get("payment_cancelled") === "1";
      const idCancelled = params.get("id_cancelled") === "1";
      if (!resumeId) return;
      if (!isLoggedIn) {
        const next = `/?book=resume&booking=${resumeId}${slotTaken ? "&slot_taken=1" : ""}`;
        navigate(`/auth?mode=signup&next=${encodeURIComponent(next)}`);
        return;
      }
      (async () => {
        const { data: booking, error } = await supabase
          .from("bookings")
          .select("id, room_title, booking_date, booking_time, customer_name, customer_phone, tier, equipment, lighting, sound, layout, verification_status, customer_email")
          .eq("id", resumeId)
          .maybeSingle();
        if (error || !booking) {
          console.error("[resume] booking lookup failed", { resumeId, error });
          toast.error("We couldn't find that booking. Please start a new one.");
          navigate("/", { replace: true });
          return;
        }
        // payment_cancelled / id_cancelled paths intentionally skip the
        // "must be approved" gate — payment_cancelled means the user is
        // verified and wants to retry checkout, id_cancelled means they
        // bailed out of Stripe Identity and we want to land them on the
        // Verify step to retry without paying.
        if (
          booking.verification_status !== "approved" &&
          !paymentCancelled &&
          !idCancelled
        ) {
          console.warn("[resume] verification not approved", { resumeId, status: booking.verification_status });
          toast.error("Verification isn't complete yet. Please try again.");
          navigate("/", { replace: true });
          return;
        }
        const match = rooms.find((r) => r.title === booking.room_title);
        if (!match) {
          console.error("[resume] no matching room", { resumeId, room: booking.room_title });
          toast.error("Could not reopen this booking.");
          navigate("/", { replace: true });
          return;
        }
        // Only mark as a "resume from approved verification" if it really
        // is approved. Otherwise (id_cancelled) we don't want the modal to
        // skip the Verify step.
        if (booking.verification_status === "approved") {
          setResumeBookingId(resumeId);
        }
        // Slot-conflict path: send the user back to the date/time picker
        // with verification preserved. Otherwise land on Consent as before.
        setInitialBookingStep(
          slotTaken
            ? "When"
            : paymentCancelled
              ? "Pay"
              : idCancelled
                ? "VerifyStripe"
                : "Consent",
        );
        setSelectedTab(match.title);
        setTabActivated(true);
        setSelectedRoom(match);
        setSelectedEquipment([]);
        setSessionSelections({
          lighting: booking.lighting || "",
          sound: booking.sound || "",
          layout: booking.layout || "",
        });
        setCustomizing(false);
        firstStepReportedRef.current = false;
        setActiveBookingSlug(normalizeBookingSlug(match.title));
        requestAnimationFrame(() => {
          setBookingOpen(true);
          window.scrollTo({ top: 0, behavior: "auto" });
        });
        if (slotTaken) {
          toast.error(
            "Your time slot is no longer available, please pick another. Your ID verification has been saved.",
            { duration: 8000 },
          );
        }
        if (paymentCancelled) {
          toast(
            "Payment cancelled — your slot is held while you decide. Try again or pick a different time.",
            { duration: 7000 },
          );
        }
        if (idCancelled) {
          toast(
            "ID verification was cancelled. Tap below to try again.",
            { duration: 7000 },
          );
        }
        // Strip query so refresh doesn't loop.
        params.delete("book");
        params.delete("booking");
        params.delete("slot_taken");
        params.delete("payment_cancelled");
        params.delete("id_cancelled");
        const qs = params.toString();
        window.history.replaceState(window.history.state, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
      })();
      return;
    }
    // Allow ?selector=1 (e.g. from /backdrops "Book" CTAs) to open the room selector.
    if (params.get("selector") === "1") {
      if (!isLoggedIn) {
        navigate(`/auth?mode=signup&next=${encodeURIComponent("/?selector=1")}`);
        return;
      }
      setSelectorOpen(true);
      params.delete("selector");
      const qs = params.toString();
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    }
    if (!bookSlug) return;
    const match = getBookableRoomFromSlug(bookSlug);
    if (!match) {
      console.error("[booking] no matching room for slug", bookSlug);
      toast.error("We couldn't open that booking. Please pick a service.");
      navigate("/", { replace: true });
      return;
    }
    if (!isLoggedIn) {
      navigate(`/auth?mode=signup&next=${encodeURIComponent(`/?book=${bookSlug}`)}`);
      return;
    }
    // Optional ?step=<label> (e.g. Date, Time, Tier, Pay) deep-links to a step.
    const stepParam = normalizeBookingStep((location.state as { openBookingStep?: string } | null)?.openBookingStep || params.get("step"));
    const idStuck = params.get("id_stuck") === "1";
    // Direct deep-link to a later step with no prior booking state — out of
    // scope to deeply hydrate, but we should at least toast and snap back to
    // the date picker so the URL doesn't lie about where the user is.
    let effectiveStep = stepParam;
    if (
      stepParam &&
      stepParam !== "Date" &&
      stepParam !== "When" &&
      stepParam !== "Time" &&
      !resumeBookingId
    ) {
      effectiveStep = "Date";
      toast("Please pick a date first.", { duration: 5000 });
    }
    // Set the deep-linked step BEFORE opening the modal so BookingModal
    // sees the correct initialStep on its first render. Then defer the
    // open to the next frame to guarantee state has flushed — this fixes
    // a Safari race where bookingOpen flipped true before initialStep
    // and selectedRoom propagated, causing the modal to render empty.
    setInitialBookingStep(effectiveStep);
    setSelectedTab(match.title);
    setTabActivated(true);
    setSelectedRoom(match);
    setSelectedEquipment([]);
    setSessionSelections({ lighting: "", sound: "", layout: "" });
    setCustomizing(false);
    firstStepReportedRef.current = false;
    setActiveBookingSlug(normalizeBookingSlug(match.title));
    // Inline-form prefill: ?date=, ?time= from a service landing page's
    // InlineBookingForm. Tier prefill via ?tier_idx= matches against
    // match.tiers (hardcoded room list); if no exact label match the modal
    // just lands on Tier step letting the user re-pick — never worse than
    // a fresh open.
    const prefillDate = params.get("date");
    const prefillTime = params.get("time");
    const tierIdxStr = params.get("tier_idx");
    setBookingPrefillDate(prefillDate || undefined);
    setBookingPrefillTime(prefillTime || undefined);
    setBookingPrefillBackdrop(params.get("backdrop") || undefined);
    if (tierIdxStr !== null && match.tiers && match.tiers.length > 0) {
      const i = parseInt(tierIdxStr, 10);
      setBookingPrefillTier(
        !isNaN(i) && i >= 0 && i < match.tiers.length ? match.tiers[i] : undefined,
      );
    } else {
      setBookingPrefillTier(undefined);
    }
    requestAnimationFrame(() => {
      setBookingOpen(true);
      window.scrollTo({ top: 0, behavior: "auto" });
    });
    if (idStuck) {
      toast.error(
        "ID verification appears stuck — please try again or contact support.",
        { duration: 8000 },
      );
      params.delete("id_stuck");
      const qs = params.toString();
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    }
    // NOTE: we intentionally leave ?book= and ?step= in the URL while the
    // modal is open. They drive the browser-back-button → step-back wiring
    // below. The query is cleared when the modal closes (handleModalOpenChange).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, location.state, authResolved, isLoggedIn]);

  const [ambientAudioEnabled, setAmbientAudioEnabled] = useState(false);

  // Lazy-init ambient audio on first interaction to reduce startup work.
  useEffect(() => {
    const enableAudio = () => setAmbientAudioEnabled(true);
    document.addEventListener("click", enableAudio, { once: true });
    document.addEventListener("touchstart", enableAudio, { once: true, passive: true });

    return () => {
      document.removeEventListener("click", enableAudio);
      document.removeEventListener("touchstart", enableAudio);
    };
  }, []);

  useEffect(() => {
    if (!ambientAudioEnabled) return;

    let widget: any = null;
    let scriptEl: HTMLScriptElement | null = document.querySelector('script[src*="soundcloud.com/player/api.js"]');

    const startAudio = () => {
      const iframe = document.getElementById("sc-bg-player") as HTMLIFrameElement;
      if (!iframe || !(window as any).SC) return;

      widget = (window as any).SC.Widget(iframe);
      widget.bind((window as any).SC.Widget.Events.READY, () => {
        widget.setVolume(5);
        widget.play();
      });
    };

    if ((window as any).SC) {
      startAudio();
    } else {
      if (!scriptEl) {
        scriptEl = document.createElement("script");
        scriptEl.src = "https://w.soundcloud.com/player/api.js";
        scriptEl.async = true;
        document.body.appendChild(scriptEl);
      }
      scriptEl.addEventListener("load", startAudio, { once: true });
    }

    return () => {
      scriptEl?.removeEventListener("load", startAudio);
    };
  }, [ambientAudioEnabled]);

  const scrollToRooms = () => {
    roomsRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Auth gate: every booking entry point must run through this. Anonymous
  // users are redirected to /auth?mode=signup with a ?next= param so we can
  // bring them back to the exact booking flow they tried to start.
  const requireAuth = (nextPath: string): boolean => {
    if (isLoggedIn) return true;
    navigate(`/auth?mode=signup&next=${encodeURIComponent(nextPath)}`);
    return false;
  };

  // PR — Browser back/forward + iOS swipe-back ↔ booking modal step nav.
  // BookingModal calls onStepChange whenever its visible step changes; we
  // mirror that into the URL (?book=<slug>&step=<label>). The first report
  // for a given open uses replaceState so the entry the user came from
  // (homepage, ad landing, etc.) stays at the top of the back stack.
  const handleBookingStepChange = (label: string) => {
    if (!activeBookingSlug) return;
    const params = new URLSearchParams(window.location.search);
    const stepLower = label.toLowerCase();
    params.set("book", activeBookingSlug);
    params.set("step", stepLower);
    const next = `${window.location.pathname}?${params.toString()}`;
    if (!firstStepReportedRef.current) {
      firstStepReportedRef.current = true;
      window.history.replaceState(
        { ...window.history.state, bookingStep: stepLower },
        "",
        next,
      );
    } else {
      window.history.pushState(
        { ...window.history.state, bookingStep: stepLower },
        "",
        next,
      );
    }
  };

  // Listen for browser back/forward while the modal is open. If ?book= is
  // gone, close the modal. If ?step= changed, drive the modal back to that
  // step via initialBookingStep (the modal re-clamps on the new value).
  useEffect(() => {
    if (!bookingOpen) return;
    const onPop = () => {
      const p = new URLSearchParams(window.location.search);
      const hasBook = p.has("book");
      if (!hasBook) {
        setBookingOpen(false);
        setActiveBookingSlug(null);
        return;
      }
      const stepNorm = normalizeBookingStep(p.get("step"));
      if (stepNorm) {
        // Force a remount of the clamp effect by toggling: set undefined
        // then back. We can't, so just set; BookingModal's clampRan ref
        // resets on close — to handle in-flight popstate we mutate via
        // a fresh string each time (label + suffix isn't ideal). Simpler:
        // we set initialBookingStep, and BookingModal's clamp effect runs
        // again because the dep `initialStep` changes only when value
        // changes. To force re-run on identical values we briefly null it.
        setInitialBookingStep(undefined);
        requestAnimationFrame(() => setInitialBookingStep(stepNorm));
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [bookingOpen]);

  // Wrap setBookingOpen so closing the modal (X / overlay click / Esc)
  // strips the booking query params from the URL — and uses navigate(-1)
  // when our step pushState entries dominate so the user lands back on
  // the page they came from (homepage, ad landing, etc.).
  const handleBookingOpenChange = (next: boolean) => {
    if (next) {
      setBookingOpen(true);
      return;
    }
    setBookingOpen(false);
    setActiveBookingSlug(null);
    setInitialBookingStep(undefined);
    setResumeBookingId(null);
    firstStepReportedRef.current = false;
    // Clear the booking-related query params without leaving them in
    // history (they'd reopen the modal on a forward-nav).
    const p = new URLSearchParams(window.location.search);
    if (p.has("book") || p.has("step") || p.has("booking")) {
      ["book", "step", "booking", "slot_taken", "payment_cancelled", "id_cancelled", "id_stuck"].forEach(
        (k) => p.delete(k),
      );
      const qs = p.toString();
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${qs ? `?${qs}` : ""}`,
      );
    }
  };


  const handleSelectorSelect = (service: typeof rooms[0]) => {
    // Custom admin-authored cards carry their own destination on
    // __customRoute. Internal paths get react-router navigate(); external URLs
    // open a new tab. Empty route + coming_soon = render-only, no nav.
    const customRoute = (service as any).__customRoute as string | undefined;
    if (customRoute !== undefined) {
      if ((service as any).comingSoon) return;
      const r = customRoute.trim();
      if (!r) return;
      setSelectorOpen(false);
      if (/^https?:\/\//i.test(r)) {
        window.open(r, "_blank", "noopener,noreferrer");
        return;
      }
      navigate(r.startsWith("/") ? r : `/${r}`);
      return;
    }
    const slug = normalizeBookingSlug(service.title);
    if (!requireAuth(`/?book=${slug}`)) return;
    setSelectorOpen(false);
    const route = roomLandingRoutes[service.title];
    if (route) {
      navigate(route);
      return;
    }
    // Fallback for rooms without a dedicated landing page.
    setSelectedTab(service.title);
    setTabActivated(true);
    scrollToRooms();
  };

  const handleBookRoom = (room: typeof rooms[0]) => {
    const slug = normalizeBookingSlug(room.title);
    if (!requireAuth(`/?book=${slug}`)) return;
    setSelectorOpen(false);
    setSelectedTab(room.title);
    setTabActivated(true);
    setSelectedRoom(room);
    setSelectedEquipment([]);
    setSessionSelections({ lighting: "", sound: "", layout: "" });
    setCustomizing(false);
    firstStepReportedRef.current = false;
    setActiveBookingSlug(slug);
    setBookingOpen(true);
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "auto" });
    });
  };

  const handleCustomizeContinue = async (selections: SessionSelections) => {
    if (bookingTransitioning) return;
    setSelectedEquipment(selections.equipment);
    setSessionSelections({ lighting: selections.lighting, sound: selections.sound, layout: selections.layout });
    setBookingTransitioning(true);

    try {
      firstStepReportedRef.current = false;
      if (selectedRoom?.title) {
        setActiveBookingSlug(normalizeBookingSlug(selectedRoom.title));
      }
      setBookingOpen(true);
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "auto" });
        setCustomizing(false);
      });
    } finally {
      setBookingTransitioning(false);
    }
  };

  const handleCustomizeBack = () => {
    setCustomizing(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <SeoHead
        title="Replay Club — Recording Studio, Podcast & DJ Booking in LA"
        description="Book DJ sessions, podcast recording, livestream studios, and equipment rentals at Replay Club — a recording studio in Van Nuys, Los Angeles. Hourly bookings from $55/hr."
        path="/"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "MusicVenue",
            name: "Replay Club",
            url: "https://replayclub.io/",
            image: "https://storage.googleapis.com/gpt-engineer-file-uploads/GbEulQM8OzSeZbUIWGdRsN0Y2si1/social-images/social-1774136317931-F005324E-2D74-4D33-A0AC-E72D77632242-Photoroom.webp",
            description: "Recording studio, podcast suite, DJ rehearsal & livestream space in Los Angeles.",
            email: "replayclubrecords@gmail.com",
            priceRange: "$$",
            areaServed: { "@type": "City", name: "Los Angeles" },
            openingHoursSpecification: [
              {
                "@type": "OpeningHoursSpecification",
                dayOfWeek: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
                opens: "10:00",
                closes: "23:00",
              },
            ],
          },
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "Replay Club Services",
            itemListElement: [
              { "@type": "Service", name: "Disk Jockey", url: "https://replayclub.io/dj-studio", offers: { "@type": "Offer", priceCurrency: "USD", price: "55" } },
              { "@type": "Service", name: "Podcast Recording", url: "https://replayclub.io/podcast-studio", offers: { "@type": "Offer", priceCurrency: "USD", price: "60" } },
              { "@type": "Service", name: "Livestream Studio", url: "https://replayclub.io/livestream-studio" },
              { "@type": "Service", name: "Equipment Rental", url: "https://replayclub.io/equipment-rental", offers: { "@type": "Offer", priceCurrency: "USD", price: "10" } },
              { "@type": "Service", name: "Photo Backdrops", url: "https://replayclub.io/backdrops" },
              { "@type": "Product", name: "Gift Cards", url: "https://replayclub.io/gift-cards" },
            ],
          },
        ]}
      />
      <Suspense fallback={null}>
        <TwitchLiveBanner />
      </Suspense>
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border/30">
        <div className="container mx-auto px-4 sm:px-6 py-2 flex items-center justify-between">
          {/* Left slot reserved for the SiteMenu hamburger (positioned fixed elsewhere).
              Mirrors the right slot width so the centered group stays optically centered. */}
          <div className={isAdmin ? "w-24 sm:w-28" : "w-16 sm:w-20"} />
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/events")}
              className="group inline-flex items-center gap-1.5 sm:gap-2 whitespace-nowrap text-muted-foreground hover:text-foreground transition-all duration-200 text-[10px] sm:text-xs font-display uppercase tracking-[0.14em] px-2.5 sm:px-4 h-11 sm:h-9 rounded-full border border-border/50 hover:border-chrome/60 bg-card/40 hover:bg-card/70 backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 transition-transform group-hover:scale-110" />
              <span>Events</span>
            </button>
            <button
              onClick={() => navigate(isLoggedIn ? "/profile" : "/auth")}
              className="group inline-flex items-center gap-1.5 sm:gap-2 whitespace-nowrap text-muted-foreground hover:text-foreground transition-all duration-200 text-[10px] sm:text-xs font-display uppercase tracking-[0.14em] px-2.5 sm:px-4 h-11 sm:h-9 rounded-full border border-border/50 hover:border-chrome/60 bg-card/40 hover:bg-card/70 backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <User className="w-3 h-3 sm:w-3.5 sm:h-3.5 transition-transform group-hover:scale-110" />
              <span>{isLoggedIn ? t("nav.profile") : t("nav.logIn")}</span>
            </button>
            <button
              onClick={() => navigate("/shop")}
              title="Shop coming soon"
              className="group relative inline-flex items-center gap-1.5 sm:gap-2 whitespace-nowrap text-muted-foreground hover:text-foreground transition-all duration-200 text-[10px] sm:text-xs font-display uppercase tracking-[0.14em] px-2.5 sm:px-4 h-11 sm:h-9 rounded-full border border-border/50 hover:border-chrome/60 bg-card/40 hover:bg-card/70 backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <ShoppingBag className="w-3 h-3 sm:w-3.5 sm:h-3.5 transition-transform group-hover:scale-110" />
              <span>Shop</span>
              <span className="hidden sm:inline px-1.5 py-0.5 rounded-sm bg-primary/20 text-primary text-[8px] font-semibold tracking-widest">Soon</span>
            </button>
          </div>
          <div className={`${isAdmin ? "w-24 sm:w-28" : "w-16 sm:w-20"} flex justify-end items-center gap-2`}>
            {isAdmin && (
              <button
                onClick={() => navigate("/admin/dashboard")}
                aria-label="Open admin panel"
                title="Admin panel"
                className="relative inline-flex items-center justify-center h-11 w-11 sm:h-10 sm:w-10 rounded-full border border-chrome/50 bg-foreground/5 text-foreground hover:bg-foreground/10 hover:border-chrome/80 transition-all duration-200 shadow-[0_2px_12px_rgba(0,0,0,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Shield className="w-4 h-4 sm:w-4 sm:h-4" />
                <span className="absolute -bottom-1 -right-1 h-2 w-2 rounded-full bg-primary ring-2 ring-background" aria-hidden="true" />
              </button>
            )}
            <AnimatePresence>
              {cartItems.size > 0 && (
                <motion.button
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  onClick={() => setCartOpen(!cartOpen)}
                  className="relative flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-[10px] sm:text-xs font-display uppercase tracking-[0.12em] px-3 py-1.5 rounded-full border border-border/50 hover:border-border bg-card/50 backdrop-blur-sm"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <motion.span
                    key={cartItems.size}
                    initial={{ scale: 1.6 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 15 }}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center"
                  >
                    {cartItems.size}
                  </motion.span>
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
        {/* Cart Dropdown */}
        <AnimatePresence>
          {cartOpen && cartItems.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="absolute right-4 sm:right-6 top-full mt-1 w-72 chrome-surface rounded-lg border border-[hsl(0_0%_25%)] backdrop-blur-xl z-50"
              style={{ boxShadow: '0 8px 30px hsl(0 0% 0% / 0.6), 0 0 40px hsl(0 0% 50% / 0.08)' }}
            >
              <div className="p-4 space-y-2 max-h-60 overflow-y-auto">
                {Array.from(cartItems).map((itemName) => {
                  const item = cartLookup(itemName);
                  if (!item) return null;
                  return (
                    <div key={itemName} className="flex items-center justify-between text-xs gap-2">
                      <span className="font-display text-foreground truncate">{itemName}</span>
                      <span className="font-display text-muted-foreground chrome-text text-[10px] whitespace-nowrap">
                        ${(item.priceCents / 100).toFixed(0)}{item.unit === "flat" ? "" : `/${item.unit}`}
                      </span>
                      <button onClick={() => setCartItems(prev => { const n = new Set(prev); n.delete(itemName); return n; })} className="text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-border/30 p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-display uppercase tracking-wider text-muted-foreground">Subtotal</span>
                  <span className="font-display font-bold text-sm chrome-text">
                    ${Array.from(cartItems).reduce((sum, name) => {
                      const item = cartLookup(name);
                      return sum + (item?.priceCents ?? 0);
                    }, 0) / 100}
                    <span className="text-[9px] text-muted-foreground ml-1 font-normal">per unit</span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <button onClick={() => setCartItems(new Set())} className="text-muted-foreground hover:text-foreground text-[10px] font-display uppercase tracking-wider">Clear</button>
                <button
                  onClick={() => {
                    setSelectedEquipment(Array.from(cartItems));
                    const equipRoom = rooms.find(r => r.title === ROOM_EQUIPMENT_RENTAL)!;
                    setSelectedRoom(equipRoom);
                    firstStepReportedRef.current = false;
                    setActiveBookingSlug(normalizeBookingSlug(equipRoom.title));
                    setBookingOpen(true);
                    setCartOpen(false);
                    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
                  }}
                  className="chrome-btn font-display font-semibold text-[10px] uppercase tracking-[0.15em] px-4 py-1.5 rounded-md"
                >
                  Book
                </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {!tabActivated && (() => {
        // Orbit ring: DB-driven (admin-editable) with hardcoded fallback so the
        // homepage never renders empty. Master toggle hides the ring entirely.
        const orbitNodes: OrbitNode[] =
          siteSettings.orbit_nodes && siteSettings.orbit_nodes.length > 0
            ? siteSettings.orbit_nodes
            : DEFAULT_ORBIT_NODES;
        const showOrbit = siteSettings.orbit_enabled !== false;
        const haloTabs = showOrbit
          ? orbitNodes.map((n) => ({
              title: n.id, // unique key for HaloNav
              displayLabel: n.title,
              mobileLabel: n.mobileLabel || n.title,
            }))
          : undefined;
        const handleOrbitSelect = (id: string) => {
          const node = orbitNodes.find((n) => n.id === id);
          if (!node) return;
          const route = node.route.trim();
          if (/^https?:\/\//i.test(route)) {
            window.open(route, "_blank", "noopener,noreferrer");
            return;
          }
          if (route.startsWith("/")) {
            navigate(route);
            return;
          }
          // Treat as in-page tab name (Backdrops, Talent, Equipment Rental, etc.)
          setSelectedTab(route);
          setTabActivated(true);
          scrollToRooms();
        };
        return (
          <HeroSection
            onBookClick={() => { if (isLoggedIn) { setSelectorOpen(true); } else { navigate("/auth?mode=signup"); } }}
            isLoggedIn={isLoggedIn}
            haloTabs={haloTabs}
            // Don't mark any tab active on the hero halo — every orbit button
            // should render at the same size until the user explicitly picks one.
            selectedTab=""
            onTabSelect={haloTabs ? handleOrbitSelect : undefined}
          />
        );
      })()}

      <ServiceSelector
        open={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        services={visibleRooms}
        onSelect={handleSelectorSelect}
      />

      {/* Selected Service Section */}
      {tabActivated && (
        <Suspense fallback={<div className="py-20 px-6 text-center"><div className="w-6 h-6 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin mx-auto" /></div>}>
        <section ref={roomsRef} className="py-20 px-6">
          <div className="container mx-auto max-w-lg">
            <AnimatePresence mode="wait">
              {selectedTab === TAB_TALENT ? (
                <motion.div
                  key="talent"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <TalentRoster />
                </motion.div>
              ) : selectedTab === TAB_BACKDROPS ? (
                <motion.div
                  key="backdrops"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {siteSettings.booking_pauses?.backdrops ? (
                    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-6 text-center">
                      <p className="font-display text-sm font-bold text-amber-300 uppercase tracking-wider mb-1">
                        Bookings temporarily paused
                      </p>
                      <p className="text-xs font-body text-muted-foreground">
                        Backdrops bookings are currently unavailable. Please check back soon.
                      </p>
                    </div>
                  ) : (
                  <BackdropsGallery
                    onContinue={(backdropName, photoPackageName) => {
                      // Pre-load the chosen backdrop (+ optional photo package)
                      // into the cart and open the Equipment Rental booking flow —
                      // backdrops are billed as hourly add-ons through that path,
                      // and PHOTO_PACKAGES are flat-fee add-ons summed at checkout.
                      const equipRoom = rooms.find(r => r.title === ROOM_EQUIPMENT_RENTAL)!;
                      const items = [backdropName];
                      // Skip the free "Self-Service Shoot" — no need to add a $0 line.
                      if (photoPackageName && photoPackageName !== "Self-Service Shoot") {
                        items.push(photoPackageName);
                      }
                      setSelectedEquipment(items);
                      setCartItems(new Set(items));
                      setSelectedRoom(equipRoom);
                      setBookingOpen(true);
                      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
                    }}
                  />
                  )}
                </motion.div>
              ) : customizing && selectedRoom ? (
                <CustomizeSession
                  key="customize"
                  room={selectedRoom}
                  onBack={handleCustomizeBack}
                  onContinue={handleCustomizeContinue}
                  isContinuing={bookingTransitioning}
                />
              ) : (
                rooms.filter(r => r.title === selectedTab).map(room => (
                  <motion.div
                    key={room.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="relative"
                  >
                    {room.title === ROOM_EQUIPMENT_RENTAL ? (
                      <EquipmentSection
                        selectedItems={cartItems}
                        onToggleItem={(name) => {
                          setCartItems(prev => {
                            const next = new Set(prev);
                            if (next.has(name)) next.delete(name);
                            else next.add(name);
                            return next;
                          });
                        }}
                        onBookSelected={(items) => {
                          setSelectedEquipment(items);
                          const equipRoom = rooms.find(r => r.title === ROOM_EQUIPMENT_RENTAL)!;
                          setSelectedRoom(equipRoom);
                          setBookingOpen(true);
                          requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
                        }}
                      />
                    ) : (
                      <RoomCard
                        title={room.title}
                        subtitle={room.subtitle}
                        image={room.image}
                        price={room.price}
                        features={room.features}
                        tiers={room.tiers}
                        minimum={room.minimum}
                        popular={(room as any).popular}
                        available={room.available}
                        imageStyle={(room as any).imageStyle}
                        galleryImages={(room as any).galleryImages}
                        onBook={() => !(room as any).comingSoon && handleBookRoom(room)}
                      />
                    )}
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </section>
        </Suspense>
      )}
      <div ref={!tabActivated ? roomsRef : undefined} />

      {/* Latest Mix */}
      <section className="py-16 px-4 border-t border-border">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <h2 className="font-display text-xl font-bold tracking-tight text-foreground">Latest Mix</h2>
          <p className="text-muted-foreground font-body text-sm">
            Fresh from the Replay Club booth — watch our latest session.
          </p>
          <YouTubeFacade videoId={latestVideoId} title="Replay Club — Latest Mix" />
          <a
            href={`https://www.youtube.com/${siteSettings.youtube_channel_handle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 chrome-btn-outline font-display font-semibold text-xs uppercase tracking-[0.15em] px-6 py-3 rounded-md transition-all"
          >
            Subscribe on YouTube
          </a>
        </div>
      </section>

      {/* Join the Roster CTA */}
      <section className="py-12 px-4 border-t border-border">
        <div className="max-w-xl mx-auto text-center space-y-4">
          <Mic className="w-6 h-6 text-chrome mx-auto" />
          <h2 className="font-display text-xl font-bold tracking-tight text-foreground">Are You a DJ?</h2>
          <p className="text-muted-foreground font-body text-sm">
            We're looking for talent to join the Replay Club roster. Submit your mix, press photo, and logo.
          </p>
          <Link
            to="/join-roster"
            className="inline-flex items-center gap-2 chrome-btn-outline font-display font-semibold text-xs uppercase tracking-[0.15em] px-6 py-3 rounded-md transition-all"
          >
            <Mic className="w-3.5 h-3.5" />
            Join the Roster
          </Link>
        </div>
      </section>

      {/* Gift Cards Banner */}
      <section className="py-12 px-4 border-t border-border">
        <div className="max-w-xl mx-auto text-center space-y-4">
          <Gift className="w-6 h-6 text-chrome mx-auto" />
          <h2 className="font-display text-xl font-bold tracking-tight text-foreground">Give the Gift of Studio Time</h2>
          <p className="text-muted-foreground font-body text-sm">
            Replay Club gift cards — available in $25, $50, and $100.
          </p>
          <Link
            to="/gift-cards"
            className="inline-flex items-center gap-2 chrome-btn-outline font-display font-semibold text-xs uppercase tracking-[0.15em] px-6 py-3 rounded-md transition-all"
          >
            <Gift className="w-3.5 h-3.5" />
            Browse Gift Cards
          </Link>
        </div>
      </section>

      <Suspense fallback={null}>
        {/* FAQ adapts to whichever tab the user has activated; falls back to
            the sitewide "general" set on the bare homepage. */}
        <FAQSection topic={tabActivated ? tabToFaqTopic(selectedTab) : "general"} />
      </Suspense>

      {/* Contact Section */}
      <section className="py-16 px-4 border-t border-border">
        <div className="max-w-xl mx-auto text-center space-y-6">
          <Globe className="w-6 h-6 text-muted-foreground mx-auto" />
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">{t("contact.title")}</h2>
          <p className="text-muted-foreground font-body text-sm">
            {t("contact.description")}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="mailto:replayclubrecords@gmail.com"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-md font-body text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Mail className="w-4 h-4" />
              replayclubrecords@gmail.com
            </a>
            <span className="inline-flex items-center gap-2 chrome-btn-outline px-6 py-3 rounded-md font-body text-sm font-medium opacity-80">
              <Globe className="w-4 h-4" />
              Private studio in Los Angeles
            </span>
          </div>
        </div>
      </section>

      <ChunkErrorBoundary
        overlay
        label="Booking failed to load."
      >
        <Suspense fallback={bookingOpen ? <BookingChunkLoading /> : null}>
          <BookingModal
            open={bookingOpen}
            onOpenChange={handleBookingOpenChange}
            room={selectedRoom}
            selectedEquipment={selectedRoom?.title === ROOM_EQUIPMENT_RENTAL ? selectedEquipment : undefined}
            sessionSelections={sessionSelections}
            tierFeatures={tierFeatures}
            initialStep={initialBookingStep}
            resumeBookingId={resumeBookingId}
            onStepChange={handleBookingStepChange}
            initialDate={bookingPrefillDate}
            initialTime={bookingPrefillTime}
            initialTierLabel={bookingPrefillTier}
            initialBackdrop={bookingPrefillBackdrop}
          />
        </Suspense>
      </ChunkErrorBoundary>
      <SiteFooter />
      <StickyMobileCTA
        hidden={bookingOpen || selectorOpen || cartOpen}
        onBookClick={() => {
          if (isLoggedIn) {
            setSelectorOpen(true);
          } else {
            navigate("/auth?mode=signup");
          }
        }}
      />
      {/* Background audio - FUMIX set (quiet, volume=10%) */}
      {ambientAudioEnabled && (
        <iframe
          id="sc-bg-player"
          width="0"
          height="0"
          allow="autoplay"
          src={siteSettings.soundcloud_embed_url || ""}
          className="hidden"
          title="Background audio"
        />
      )}
    </div>
  );
};

export default Index;
