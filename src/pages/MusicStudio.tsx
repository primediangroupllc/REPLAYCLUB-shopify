import { useNavigate } from "react-router-dom";
import ServiceLandingPage from "@/components/ServiceLandingPage";
import musicStudioImg from "@/assets/music-studio.jpg";
import { useStudioConfig } from "@/hooks/useStudioConfig";
import NotFound from "@/pages/NotFound";

const formatHourly = (cents: number, flatAddon?: number) => {
  if (cents === 0 && !flatAddon) return "Custom Quote";
  const base = `$${(cents / 100).toFixed(0)}/hr`;
  if (flatAddon && flatAddon > 0) {
    return `${base} +$${(flatAddon / 100).toFixed(0)} flat`;
  }
  return base;
};

const MusicStudio = () => {
  const navigate = useNavigate();
  const { config, loading } = useStudioConfig("music");

  if (!loading && config && config.is_active === false) {
    return <NotFound />;
  }

  // Tier display reads from admin-editable config; falls back built into the hook.
  const tiers =
    (config?.tiers ?? []).map((t) => ({
      label: t.label,
      price: formatHourly(t.price_cents_per_hour, t.flat_addon_cents),
      features: t.features,
    })) || [];

  // Highlights: surface the layouts + first three add-ons so admins can shape
  // the landing page without touching code.
  const highlights = [
    ...(config?.layouts ?? []).map((l) => `${l.name}${l.description ? ` — ${l.description}` : ""}`),
    ...(config?.addons ?? []).slice(0, 4).map((a) => a.name),
    "Acoustic-treated control room",
    "Same-day file delivery",
  ];

  return (
    <ServiceLandingPage
      slug="music-studio"
      title="Music"
      headline="Music Recording Studio"
      metaTitle="Music Recording Studio Los Angeles | Replay Club"
      metaDescription="Book a hybrid music recording studio in Los Angeles — tracking room, vocal booth, and full-band setups. Engineer-led sessions available. Replay Club."
      description={
        config?.description ??
        "Hybrid recording studio for tracking, vocals, and full-band sessions. Engineer-led or self-serve."
      }
      heroImage={musicStudioImg}
      dbHeroUrl={config?.hero_image_url}
      tiers={tiers}
      highlights={highlights}
      faqs={[
        {
          question: "Can I bring my own engineer?",
          answer:
            "Yes. The Self-Serve tier gives you the room and pre-patched mic lines so your own engineer can run the session.",
        },
        {
          question: "What's the minimum booking?",
          answer:
            "All music sessions have a 2-hour minimum so we can properly set up mics and headphone mixes.",
        },
        {
          question: "Do you provide mixing and mastering?",
          answer:
            "Yes — add the Mix & Master add-on at checkout, or upgrade to the Premium Production tier which includes a mixing session credit.",
        },
        {
          question: "What gear is available?",
          answer:
            "Vintage condenser mics (Sony C800, U87, BACH 195), Prophet 8 synth, JBL monitors, and a fully patched console. Add the Mic Locker add-on to unlock vintage mics.",
        },
        {
          question: "Can I record a full band live?",
          answer:
            "Yes — choose the Full Band Setup layout and the Engineered or Premium tier. We'll configure the drum area and headphone mixes ahead of your session.",
        },
      ]}
      ctaLabel="Book a Music Session"
      onBook={() => navigate("/?book=music", { state: { openBookingFor: "music" } })}
      useInlineForm
      inlineFullFlow
      bookingSlug="music"
      setupsGallery={config?.layouts ?? []}
      setupsTitle="Room Configurations"
    />
  );
};

export default MusicStudio;
