import { useNavigate } from "react-router-dom";
import { Mic, Music, Users, Sparkles, ArrowRight } from "lucide-react";
import logo from "@/assets/logo.png";

const RosterInfo = () => {
  const navigate = useNavigate();

  const perks = [
    {
      icon: Mic,
      title: "Studio Access",
      copy: "Record, rehearse, and refine your sound at Replay Club's flagship Van Nuys studio.",
    },
    {
      icon: Users,
      title: "Built-in Audience",
      copy: "Get featured on our talent roster, social channels, and curated livestreams.",
    },
    {
      icon: Music,
      title: "Mix Hosting",
      copy: "Premium hosting for your sets — high-quality streaming, waveform players, and shareable artwork.",
    },
    {
      icon: Sparkles,
      title: "Curated Bookings",
      copy: "Priority placement for events, brand collaborations, and label opportunities.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="sticky top-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border/30">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          {/* Left spacer must clear the floating SiteMenu cluster (top-3 left-3 z-51, ~96px wide). */}
          <div className="w-24 sm:w-28" />
          <img src={logo} alt="Replay Club" className="w-24 mix-blend-screen" />
          <div className="w-12" />
        </div>
      </nav>

      <main className="container mx-auto max-w-3xl px-4 py-12 md:py-20 space-y-12">
        {/* Hero */}
        <section className="text-center space-y-4">
          <p className="text-xs font-display uppercase tracking-[0.3em] text-muted-foreground">
            Replay Club Talent
          </p>
          <h1 className="font-display text-4xl md:text-6xl font-bold chrome-text leading-tight">
            Are you looking to join the roster?
          </h1>
          <p className="text-base md:text-lg text-muted-foreground font-body max-w-xl mx-auto leading-relaxed">
            We're building a curated collective of DJs, producers, and selectors who push the
            culture forward. If that sounds like you — we want to hear your sound.
          </p>
        </section>

        {/* Perks grid */}
        <section className="grid sm:grid-cols-2 gap-4">
          {perks.map((perk) => (
            <div
              key={perk.title}
              className="chrome-surface rounded-lg p-5 space-y-3"
            >
              <perk.icon className="w-6 h-6 text-foreground" />
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">
                {perk.title}
              </h3>
              <p className="text-sm text-muted-foreground font-body leading-relaxed">
                {perk.copy}
              </p>
            </div>
          ))}
        </section>

        {/* CTA */}
        <section className="text-center space-y-4 pt-4">
          <button
            onClick={() => navigate("/join-roster")}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-display text-sm font-semibold uppercase tracking-wider px-8 py-4 rounded-md hover:bg-primary/90 transition-all"
          >
            Apply Now
            <ArrowRight className="w-4 h-4" />
          </button>
          <p className="text-xs text-muted-foreground font-body">
            Submissions are reviewed by our A&R team. We respond to every applicant.
          </p>
        </section>
      </main>
    </div>
  );
};

export default RosterInfo;
