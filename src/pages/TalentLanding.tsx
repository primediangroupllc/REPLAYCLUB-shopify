import { Suspense, lazy } from "react";
import SeoHead from "@/components/SeoHead";
import SiteFooter from "@/components/SiteFooter";

const TalentRoster = lazy(() => import("@/components/TalentRoster"));

const TalentLanding = () => {
  return (
    <div className="min-h-screen bg-background">
      <SeoHead
        title="Book a DJ — Talent Roster | Replay Club"
        description="Browse the Replay Club DJ roster. Book FUMIX, SEREDA, SPLIT SIGNAL, MIKELANGELO and more for events, residencies, and private bookings in Los Angeles."
        path="/talent"
      />
      <main className="container mx-auto px-4 pt-32 pb-20">
        <header className="max-w-3xl mx-auto text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Talent Roster
          </h1>
          <p className="text-lg text-muted-foreground">
            The Replay Club DJ roster — available for events, residencies, and private
            bookings. Tap any artist to view their profile or send a booking inquiry.
          </p>
        </header>
        <Suspense fallback={<div className="min-h-[40vh]" />}>
          <TalentRoster />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
};

export default TalentLanding;