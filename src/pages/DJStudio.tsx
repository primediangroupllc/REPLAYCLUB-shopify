import { useNavigate } from "react-router-dom";
import ServiceLandingPage from "@/components/ServiceLandingPage";
import djRoomImg from "@/assets/dj-room.webp";
import { useStudioConfig } from "@/hooks/useStudioConfig";
import NotFound from "@/pages/NotFound";
import { useBookingTabMetaByType } from "@/hooks/useBookingTabsMeta";

const formatHourly = (cents: number, flatAddon?: number) => {
  if (cents === 0 && !flatAddon) return "Custom Quote";
  const base = `$${(cents / 100).toFixed(0)}/hr`;
  if (flatAddon && flatAddon > 0) return `${base} +$${(flatAddon / 100).toFixed(0)} flat`;
  return base;
};

const DJStudio = () => {
  const navigate = useNavigate();
  const { config, loading } = useStudioConfig("dj");
  const meta = useBookingTabMetaByType("dj_session");

  if (!loading && config && config.is_active === false) {
    return <NotFound />;
  }

  // Tiers come from admin-editable config. Hook's FALLBACK keeps the page
  // rendering if the DB row is missing or the network fails.
  const tiers = (config?.tiers ?? []).map((t) => ({
    label: t.label,
    price: formatHourly(t.price_cents_per_hour, t.flat_addon_cents),
    features: t.features,
  }));

  return (
    <ServiceLandingPage
      slug="dj-studio"
      title={meta?.title || "Disk Jockey"}
      headline="DJ Studio Rental"
      metaTitle="DJ Studio Rental Los Angeles | Replay Club"
      metaDescription="Book a DJ studio session in Los Angeles with AlphaTheta XDJ-AZ, LED lighting, and pro monitoring. Starting at $55/hr at Replay Club."
      description={
        config?.description ??
        "Professional DJ rehearsal and recording space with industry-standard equipment, custom lighting, and multiple backdrop options."
      }
      heroImage={djRoomImg}
      dbHeroUrl={config?.hero_image_url}
      bookingType="dj_session"
      tiers={tiers}
      highlights={[
        "AlphaTheta XDJ-AZ controller",
        "Custom lighting setup included",
        "4 backdrop options: Black Abyss, Greenscreen, Office White, Wood Grid",
        "Sony 4K dashcam overhead view",
        "Sony FX3 cinema camera (Showtime tier)",
        "JBL 305P MKii monitors",
        "DT 990 Pro headphones",
        "LED light bars for atmosphere",
      ]}
      faqs={[
        { question: "Can I bring my own controller?", answer: "Yes! You're welcome to bring your own gear. We have a standard DJ booth setup with RCA and XLR inputs ready to go." },
        { question: "What's the minimum booking?", answer: "All DJ sessions have a 2-hour minimum booking. That comes to $110 for the self-service tier." },
        { question: "Can I record my set?", answer: "Absolutely. Our Showtime tier includes Sony FX3 cinema recording plus a 4K overhead dashcam angle. You'll get the files same day." },
        { question: "Do you provide USB drives?", answer: "We recommend bringing your own USB with your tracks loaded. We have backup drives available just in case." },
        { question: "What backdrop options are available?", answer: "Choose from Black Abyss, Greenscreen, Office White, or Wood Grid — all included with Performance and Showtime tiers." },
      ]}
      ctaLabel="Book a Disk Jockey Session"
      onBook={() => navigate("/?book=dj", { state: { openBookingFor: "dj" } })}
      useInlineForm
      inlineFullFlow
      bookingSlug="dj"
      setupsGallery={config?.layouts ?? []}
      setupsTitle="Available Backdrops"
    />
  );
};

export default DJStudio;
