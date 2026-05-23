import { useNavigate } from "react-router-dom";
import ServiceLandingPage from "@/components/ServiceLandingPage";
import eventsImg from "@/assets/events-hero.jpg";

const EventsLanding = () => {
  const navigate = useNavigate();

  return (
    <ServiceLandingPage
      slug="events-info"
      title="Members Events"
      headline="Members-Only Events"
      metaTitle="Members Events Los Angeles | Replay Club"
      metaDescription="Intimate members-only events at Replay Club Los Angeles — listening sessions, DJ showcases, label nights, and pop-ups. RSVP now."
      description="Listening sessions, DJ showcases, label nights, and pop-ups — curated drops, limited capacity, members first."
      heroImage={eventsImg}
      heroImageStyle={{ objectPosition: "center 40%" }}
      tiers={[]}
      highlights={[
        "Curated lineup of in-house and guest artists",
        "Limited-capacity rooms — intimate by design",
        "Listening sessions, DJ showcases, label nights, and pop-ups",
        "Members-first RSVP with waitlist auto-promotion",
        "Free and ticketed events — refund policy per event",
        "Ticket pass with QR check-in delivered by email",
      ]}
      faqs={[
        { question: "Who can attend?", answer: "Most events are members-first. Sign in to RSVP — some events open to the public after a member-priority window." },
        { question: "How do tickets work?", answer: "Free events use simple RSVPs; paid events use Stripe checkout. You'll get an emailed ticket pass with a QR code for check-in." },
        { question: "What if an event is sold out?", answer: "Join the waitlist and we'll auto-promote you (and email immediately) the moment a confirmed seat opens up. You'll have a short window to claim it." },
        { question: "Can I cancel or transfer my RSVP?", answer: "You can cancel from the events page anytime. Refunds depend on the event's refund policy listed on each event card." },
      ]}
      ctaLabel="See Upcoming Events"
      onBook={() => navigate("/events")}
    />
  );
};

export default EventsLanding;