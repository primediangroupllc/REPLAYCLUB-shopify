import { useNavigate } from "react-router-dom";
import ServiceLandingPage from "@/components/ServiceLandingPage";
import livestreamImg from "@/assets/livestream.jpg";
import { useStudioConfig } from "@/hooks/useStudioConfig";
import NotFound from "@/pages/NotFound";

const formatHourly = (cents: number, flatAddon?: number) => {
  if (cents === 0 && !flatAddon) return "Custom Quote";
  const base = `$${(cents / 100).toFixed(0)}/hr`;
  if (flatAddon && flatAddon > 0) return `${base} +$${(flatAddon / 100).toFixed(0)} flat`;
  return base;
};

const LivestreamStudio = () => {
  const navigate = useNavigate();
  const { config, loading } = useStudioConfig("livestream");

  if (!loading && config && config.is_active === false) {
    return <NotFound />;
  }

  // Livestream is a general bookable service now (not inquiry-only). All
  // tiers admin has configured at /admin/services show in the tier picker;
  // tiers priced at $0 are still allowed (rendered as "Custom Quote") so
  // admin can keep an inquiry path alongside priced tiers if they want.
  const tiers = (config?.tiers ?? []).map((t) => ({
    label: t.label,
    price: formatHourly(t.price_cents_per_hour, t.flat_addon_cents),
    features: t.features,
  }));

  return (
    <ServiceLandingPage
      slug="livestream-studio"
      title="Livestream"
      headline="Livestream Studio"
      metaTitle="Livestream Studio Los Angeles | Replay Club"
      metaDescription="Professional livestream studio in Los Angeles with multi-camera setups, real-time streaming, and broadcast-quality audio. Inquire at Replay Club."
      description={
        config?.description ??
        "Broadcast-quality livestream studio with multi-camera rigs, pro audio mixing, and real-time streaming to any platform."
      }
      heroImage={livestreamImg}
      dbHeroUrl={config?.hero_image_url}
      heroImageStyle={{ objectPosition: "center 80%" }}
      tiers={tiers}
      highlights={[
        "Multi-camera setup (Sony FX3 + Canon 90D)",
        "Sony 4K action cam for alternate angles",
        "Professional audio mixing",
        "Real-time streaming to Twitch, YouTube, Instagram & more",
        "DJI wireless mics for mobility",
        "Rode shotgun mic for directional audio",
        "GVM PRO-SD300B key light",
        "LED light bars for atmosphere",
        "Ronin RS3 Mini gimbal available",
      ]}
      faqs={[
        { question: "Which platforms can I stream to?", answer: "We support simultaneous streaming to Twitch, YouTube, Instagram Live, Facebook, and custom RTMP destinations." },
        { question: "How do I book a livestream?", answer: "Livestream sessions are custom-quoted based on your needs. Click Inquire and we'll get back to you within 24 hours with a tailored package." },
        { question: "Can I record and stream at the same time?", answer: "Yes! We capture a local high-quality recording alongside your live broadcast so you get the best of both." },
        { question: "Do you provide a technical operator?", answer: "All livestream sessions include a dedicated technician to manage cameras, switching, and audio during your broadcast." },
      ]}
      ctaLabel="Book a Livestream Session"
      onBook={() => navigate("/?book=livestream", { state: { openBookingFor: "livestream" } })}
      useInlineForm
      inlineFullFlow
      bookingSlug="livestream"
      setupsGallery={config?.layouts ?? []}
      setupsTitle="Available Configurations"
    />
  );
};

export default LivestreamStudio;
