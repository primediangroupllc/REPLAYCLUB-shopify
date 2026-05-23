import { useNavigate } from "react-router-dom";
import ServiceLandingPage from "@/components/ServiceLandingPage";
import podcastImg from "@/assets/podcast-room-new.jpg";
import { useStudioConfig } from "@/hooks/useStudioConfig";
import NotFound from "@/pages/NotFound";
import { useBookingTabMetaByType } from "@/hooks/useBookingTabsMeta";

const formatHourly = (cents: number, flatAddon?: number) => {
  if (cents === 0 && !flatAddon) return "Custom Quote";
  const base = `$${(cents / 100).toFixed(0)}/hr`;
  if (flatAddon && flatAddon > 0) return `${base} +$${(flatAddon / 100).toFixed(0)} flat`;
  return base;
};

const PodcastStudio = () => {
  const navigate = useNavigate();
  const { config, loading } = useStudioConfig("podcast");
  const meta = useBookingTabMetaByType("podcast");

  // Admin can hide a service via /admin/services. When inactive, render 404
  // so the URL is no longer a working customer entry point.
  if (!loading && config && config.is_active === false) {
    return <NotFound />;
  }

  const tiers = (config?.tiers ?? []).map((t) => ({
    label: t.label,
    price: formatHourly(t.price_cents_per_hour, t.flat_addon_cents),
    features: t.features,
  }));

  return (
    <ServiceLandingPage
      slug="podcast-studio"
      title={meta?.title || "Podcast"}
      headline="Podcast Studio Rental"
      metaTitle="Podcast Studio Rental Los Angeles | Replay Club"
      metaDescription="Record your podcast in a soundproofed Los Angeles studio with pro mics, multi-camera setups, and custom backdrops. Starting at $60/hr at Replay Club."
      description={
        config?.description ??
        "Soundproofed podcast suite with professional microphones, multi-camera video, and a distraction-free environment for your best episode yet."
      }
      heroImage={podcastImg}
      bookingType="podcast"
      dbHeroUrl={config?.hero_image_url}
      heroImageStyle={{ transform: "scale(0.85)", objectPosition: "center center" }}
      tiers={tiers}
      highlights={[
        "Shure SM7B & Neumann TLM 103 microphones",
        "Multi-camera video recording",
        "Acoustic-treated, soundproofed room",
        "4 backdrop options: Black Abyss, Greenscreen, Office White, Wood Grid",
        "Custom lighting setups available",
        "DJI wireless mics for mobile segments",
        "Phone ring lights included",
        "Same-day file delivery",
      ]}
      faqs={[
        { question: "How many guests can I bring?", answer: "Our podcast suite comfortably fits up to 4 people with individual mic setups. For larger groups, reach out to discuss custom arrangements." },
        { question: "Do you edit the podcast?", answer: "We provide the raw audio and video files same-day. Editing services can be arranged separately — just ask!" },
        { question: "Can I livestream my podcast?", answer: "Yes! Check out our Livestream service for real-time streaming capabilities with multi-camera support." },
        { question: "What file formats do you deliver?", answer: "Audio is delivered in WAV and MP3. Video is delivered in MP4 (H.264) at up to 4K resolution." },
        { question: "Can I use my own mic?", answer: "Absolutely. We have XLR and USB inputs available, so bring whatever you're comfortable with." },
      ]}
      ctaLabel="Book a Podcast Session"
      onBook={() => navigate("/?book=podcast", { state: { openBookingFor: "podcast" } })}
      useInlineForm
      inlineFullFlow
      bookingSlug="podcast"
      setupsGallery={config?.layouts ?? []}
      setupsTitle="Studio Setups"
    />
  );
};

export default PodcastStudio;
