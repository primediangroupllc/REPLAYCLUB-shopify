import { lazy, Suspense, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import { useUtmCapture } from "@/hooks/useUtmCapture";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/context/CartContext";
import SiteMenu from "./components/SiteMenu.tsx";
import { initMetaPixel, trackPageView } from "@/lib/metaPixel";
import SiteSettingsBoot from "./components/SiteSettingsBoot.tsx";
import { ChunkErrorBoundary } from "./components/ChunkErrorBoundary.tsx";
import VersionCheck from "./components/VersionCheck.tsx";

// Critical route — eagerly loaded
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";

// Non-critical, deferred to keep initial paint fast
const CookieConsent = lazy(() => import("./components/CookieConsent.tsx"));
const RecoveryRedirect = lazy(() => import("./components/RecoveryRedirect.tsx"));
const CommandPalette = lazy(() => import("./components/CommandPalette.tsx"));

// Lazy-loaded routes to reduce initial bundle
const Auth = lazy(() => import("./pages/Auth.tsx"));
const Profile = lazy(() => import("./pages/Profile.tsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.tsx"));
const BookingSuccess = lazy(() => import("./pages/BookingSuccess.tsx"));
const BookingReturn = lazy(() => import("./pages/BookingReturn.tsx"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy.tsx"));
const EntryTerms = lazy(() => import("./pages/EntryTerms.tsx"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard.tsx"));
const AdminPromo = lazy(() => import("./pages/AdminPromo.tsx"));
const PromoRedeem = lazy(() => import("./pages/PromoRedeem.tsx"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe.tsx"));
const GiftCards = lazy(() => import("./pages/GiftCards.tsx"));
const TalentProfile = lazy(() => import("./pages/TalentProfile.tsx"));
const JoinRoster = lazy(() => import("./pages/JoinRoster.tsx"));
const RosterInfo = lazy(() => import("./pages/RosterInfo.tsx"));
const DJStudio = lazy(() => import("./pages/DJStudio.tsx"));
const PodcastStudio = lazy(() => import("./pages/PodcastStudio.tsx"));
const LivestreamStudio = lazy(() => import("./pages/LivestreamStudio.tsx"));
const MusicStudio = lazy(() => import("./pages/MusicStudio.tsx"));
const Photoshoot = lazy(() => import("./pages/Photoshoot.tsx"));
const TalentLanding = lazy(() => import("./pages/TalentLanding.tsx"));
const EquipmentRental = lazy(() => import("./pages/EquipmentRental.tsx"));
const BackdropsLanding = lazy(() => import("./pages/BackdropsLanding.tsx"));
const EventsLanding = lazy(() => import("./pages/EventsLanding.tsx"));
const SessionPage = lazy(() => import("./pages/SessionPage.tsx"));
const Events = lazy(() => import("./pages/Events.tsx"));
const EventDetail = lazy(() => import("./pages/EventDetail.tsx"));
const EventConfirmation = lazy(() => import("./pages/EventConfirmation.tsx"));
const AdminScan = lazy(() => import("./pages/AdminScan.tsx"));
const AdminEventsHomepage = lazy(() => import("./pages/AdminEventsHomepage.tsx"));
const AdminHomepageEdit = lazy(() => import("./pages/AdminHomepageEdit.tsx"));
const AdminServices = lazy(() => import("./pages/AdminServices.tsx"));
const AdminBookingTabImages = lazy(() => import("./pages/AdminBookingTabImages.tsx"));
const EventsPreview = lazy(() => import("./pages/EventsPreview.tsx"));
const HostDashboard = lazy(() => import("./pages/HostDashboard.tsx"));
const SellRedirect = lazy(() => import("./pages/SellRedirect.tsx"));
const Shop = lazy(() => import("./pages/Shop.tsx"));
const AdminRunbook = lazy(() => import("./pages/AdminRunbook.tsx"));
const AdminLinkCheck = lazy(() => import("./pages/AdminLinkCheck.tsx"));
const BookingStatus = lazy(() => import("./pages/BookingStatus.tsx"));
const Policies = lazy(() => import("./pages/Policies.tsx"));
const Cancellation = lazy(() => import("./pages/Cancellation.tsx"));
const Conduct = lazy(() => import("./pages/Conduct.tsx"));
const HowItWorks = lazy(() => import("./pages/HowItWorks.tsx"));

// Sensible cache defaults so data like events, talent roster, and gallery
// don't refetch on every navigation. Individual queries can still override.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min — treat data as fresh, no auto-refetch
      gcTime: 30 * 60 * 1000, // 30 min — keep cached data in memory after unmount
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

const SessionTimeoutWrapper = ({ children }: { children: React.ReactNode }) => {
  useSessionTimeout();
  useUtmCapture();
  return <>{children}</>;
};

/**
 * Initialises the Meta Pixel once (lazily fetches the configured Pixel ID from
 * site_settings) and fires PageView on every route change. Safe no-op when no
 * Pixel ID is configured in admin yet.
 */
const MetaPixelTracker = () => {
  const location = useLocation();
  useEffect(() => {
    initMetaPixel().then((id) => { if (id) trackPageView(); });
  }, [location.pathname]);
  return null;
};

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Sonner />
        <CartProvider>
        <BrowserRouter>
        <MetaPixelTracker />
        <SiteSettingsBoot />
        <VersionCheck />
        <Suspense fallback={null}>
          <RecoveryRedirect />
        </Suspense>
        <SiteMenu />
        <Suspense fallback={null}>
          <CommandPalette />
        </Suspense>
        <SessionTimeoutWrapper>
          <ChunkErrorBoundary label="This page failed to load.">
            <Suspense fallback={<div className="min-h-screen bg-background" />}>
              <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/booking-success" element={<BookingSuccess />} />
              <Route path="/booking/return" element={<BookingReturn />} />
              <Route path="/booking-status/:token" element={<BookingStatus />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/entry-terms" element={<EntryTerms />} />
              <Route path="/terms" element={<Navigate to="/entry-terms" replace />} />
              <Route path="/policies" element={<Policies />} />
              <Route path="/cancellation" element={<Cancellation />} />
              <Route path="/conduct" element={<Conduct />} />
              <Route path="/how-it-works" element={<HowItWorks />} />
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="/admin/homepage" element={<AdminHomepageEdit />} />
              <Route path="/admin/settings" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="/admin/services" element={<AdminServices />} />
              <Route path="/admin/booking-tab-images" element={<AdminBookingTabImages />} />
              <Route path="/dj" element={<DJStudio />} />
              <Route path="/podcast" element={<PodcastStudio />} />
              <Route path="/recording" element={<Navigate to="/music-studio" replace />} />
              <Route path="/backdrop" element={<BackdropsLanding />} />
              <Route path="/admin/promos" element={<AdminPromo />} />
              <Route path="/admin/runbook" element={<AdminRunbook />} />
              <Route path="/admin/link-check" element={<AdminLinkCheck />} />
              <Route path="/promo/:token" element={<PromoRedeem />} />
              <Route path="/unsubscribe" element={<Unsubscribe />} />
              <Route path="/gift-cards" element={<GiftCards />} />
              <Route path="/join-roster" element={<JoinRoster />} />
              <Route path="/roster-info" element={<RosterInfo />} />
              <Route path="/talent/:id" element={<TalentProfile />} />
              <Route path="/dj-studio" element={<DJStudio />} />
              <Route path="/podcast-studio" element={<PodcastStudio />} />
              <Route path="/livestream-studio" element={<LivestreamStudio />} />
              <Route path="/music-studio" element={<MusicStudio />} />
              <Route path="/studio-sesh" element={<Navigate to="/music-studio" replace />} />
              <Route path="/photoshoot" element={<Photoshoot />} />
              <Route path="/talent" element={<TalentLanding />} />
              <Route path="/equipment-rental" element={<EquipmentRental />} />
              <Route path="/backdrops" element={<BackdropsLanding />} />
              <Route path="/events-info" element={<EventsLanding />} />
              <Route path="/bookings/:id" element={<TalentProfile />} />
              <Route path="/session/:token" element={<SessionPage />} />
              <Route path="/events" element={<Events />} />
              <Route path="/events/:slugOrId" element={<EventDetail />} />
              <Route path="/events/:slugOrId/confirmation" element={<EventConfirmation />} />
              <Route path="/admin/scan" element={<AdminScan />} />
              <Route path="/admin/events/homepage" element={<AdminEventsHomepage />} />
              <Route path="/admin/events" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="/events-preview" element={<EventsPreview />} />
              <Route path="/host/:token" element={<HostDashboard />} />
              <Route path="/sell/:token" element={<SellRedirect />} />
              <Route path="/shop" element={<Shop />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ChunkErrorBoundary>
          <Suspense fallback={null}>
            <CookieConsent />
          </Suspense>
        </SessionTimeoutWrapper>
        </BrowserRouter>
        </CartProvider>
      </TooltipProvider>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
