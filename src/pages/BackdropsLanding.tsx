import { useNavigate } from "react-router-dom";
import ServiceLandingPage from "@/components/ServiceLandingPage";
import BackdropDetailTabs from "@/components/BackdropDetailTabs";
import backdropImg from "@/assets/backdrop-black-abyss.webp";
import { useBookingTabMetaByType } from "@/hooks/useBookingTabsMeta";

const BackdropsLanding = () => {
  const navigate = useNavigate();
  const meta = useBookingTabMetaByType("backdrop");

  return (
    <ServiceLandingPage
      slug="backdrops"
      title={meta?.title || "Backdrops"}
      headline="Studio Backdrops & Photo Packages"
      metaTitle="Studio Backdrops & Photo Packages Los Angeles | Replay Club"
      metaDescription="Rent professional backdrops and book in-house photographers in Los Angeles. Black Abyss, Greenscreen, Office White, and Wood Grid options at Replay Club."
      description="Four pro backdrops, hourly add-on pricing, and optional in-house photographer packages — stack any combo onto your studio booking."
      heroImage={backdropImg}
      heroImageStyle={{ objectPosition: "center center" }}
      bookingType="backdrop"
      tiers={[]}
      customSection={<BackdropDetailTabs onBook={() => navigate("/?tab=Backdrops")} />}
      highlights={[
        "4 backdrop options — Black Abyss, Greenscreen, Office White, Wood Grid",
        "Stack onto any room booking as hourly add-ons",
        "In-house photographer packages available (BYO or our crew)",
        "Add-on bundles and à-la-carte gear (lighting, mics, cameras)",
        "Same-day file delivery on photographer packages",
        "Full lighting kits and modifiers included",
      ]}
      faqs={[
        { question: "How do backdrops get billed?", answer: "Backdrops are paid hourly add-ons that stack onto your existing room booking. Pick one or several when you customize your session." },
        { question: "Can I book backdrops without a room?", answer: "Backdrops live inside the booking flow — start by picking a room (DJ, Podcast, Livestream), then add the backdrops you need from the Backdrops step." },
        { question: "Do I need a photographer?", answer: "No — bring your own, or pick from our photographer packages once you've added a backdrop. Our crew handles everything from lighting to same-day delivery." },
        { question: "Can I switch backdrops mid-session?", answer: "Yes. Our team will swap backdrops on-site between setups so you can shoot multiple looks in one block." },
      ]}
      ctaLabel="Browse Backdrops"
      onBook={() => navigate("/?tab=Backdrops")}
    />
  );
};

export default BackdropsLanding;
