import { useNavigate } from "react-router-dom";
import ServiceLandingPage from "@/components/ServiceLandingPage";
import studioAImg from "@/assets/studio-a.jpg";
import { useBookingTabMetaByType } from "@/hooks/useBookingTabsMeta";

const Photoshoot = () => {
  const navigate = useNavigate();
  const meta = useBookingTabMetaByType("backdrop");

  return (
    <ServiceLandingPage
      slug="photoshoot"
      title={meta?.title || "Photoshoot"}
      headline="Photoshoot Studio"
      metaTitle="Photoshoot Studio Rental Los Angeles | Replay Club"
      metaDescription="Professional photoshoot studio in Los Angeles with multiple backdrops, pro lighting, and optional in-house photographer. Book from $70/hr at Replay Club."
      description="A flexible photo space with multiple backdrops, pro lighting, and the option to bring your own photographer or hire ours."
      heroImage={studioAImg}
      bookingType="backdrop"
      tiers={[
        {
          label: "Lighting + Space",
          price: "$70/hr",
          features: ["Backdrop access", "Pro key/fill lighting", "Bring your own photographer"],
        },
        {
          label: "Camera Included",
          price: "$110/hr",
          features: ["Sony FX3 or Canon 90D", "Pro lens kit", "Lighting + backdrop"],
        },
        {
          label: "Full Content Setup",
          price: "$165/hr",
          features: ["Camera + advanced lighting", "Backdrop choice", "On-set technical support"],
        },
      ]}
      highlights={[
        "Multiple backdrops: Black Abyss, Greenscreen, Office White, Wood Grid",
        "GVM PRO-SD300B key light + LED bars",
        "Sony FX3 and Canon 90D bodies",
        "Canon 70-200mm + Prism FX lens kit",
        "Photo packages with in-house photographer available",
        "2-hour minimum booking",
      ]}
      faqs={[
        { question: "Can I bring my own photographer?", answer: "Yes — the Self-Service / Lighting + Space tier is built for it. You get the backdrop and lighting; you bring the camera and crew." },
        { question: "Do you offer photo packages with a photographer?", answer: "Yes. Choose from Basic (50 photos), Professional (100 photos), or Premium Editorial (200 photos) during the booking flow. Pricing and turnaround details are shown at checkout." },
        { question: "How many people can be on set?", answer: "Photoshoot sessions fit up to 3 people total (including the primary booker). Larger crews can request approval during the application — add a short note about your team." },
        { question: "Can I bring my own backdrop?", answer: "Yes, custom backdrops are welcome. Let us know in advance so we can set up the right rigging." },
        { question: "How are photos delivered?", answer: "Online gallery delivery. Turnaround depends on the package — 48 hours (Premium) to 5 days (Basic)." },
      ]}
      ctaLabel="Book a Photoshoot"
      onBook={() => navigate("/?book=photoshoot", { state: { openBookingFor: "photoshoot" } })}
      useInlineForm
      inlineFullFlow
      bookingSlug="photoshoot"
    />
  );
};

export default Photoshoot;
