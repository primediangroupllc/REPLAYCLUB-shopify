import { useEffect, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import logo from "@/assets/logo.png";
import BrandLogo from "@/components/BrandLogo";
import equipmentImg from "@/assets/equipment-rentals.webp";
import OptimizedImage from "@/components/OptimizedImage";
import { useBookingTabImages, useBookingTabLayout } from "@/hooks/useBookingTabImages";
import { BookingTabImagesRenderer } from "@/components/BookingTabImageLayouts";

// Heavy cart component (Stripe + form state) — defer until below-the-fold
const EquipmentRentalCart = lazy(() => import("@/components/EquipmentRentalCart"));

const EquipmentRental = () => {
  const { data: dbImages } = useBookingTabImages("equipment_rental", true);
  const { data: layoutVariant } = useBookingTabLayout("equipment_rental");
  const tabImages = dbImages ?? [];
  const useDb = tabImages.length > 0;
  const variant = layoutVariant ?? "gallery";
  useEffect(() => {
    document.title = "Equipment Rental Los Angeles | DJ, Camera & Audio Gear | Replay Club";
    const metaDesc = document.querySelector('meta[name="description"]');
    const content = "Rent professional DJ controllers, cinema cameras, microphones, and audio gear in Los Angeles. Daily rates from $10/day at Replay Club.";
    if (metaDesc) metaDesc.setAttribute("content", content);
    else {
      const meta = document.createElement("meta");
      meta.name = "description";
      meta.content = content;
      document.head.appendChild(meta);
    }

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Service",
      name: "Equipment Rental",
      description: content,
      provider: {
        "@type": "LocalBusiness",
        name: "Replay Club",
        address: { "@type": "PostalAddress", addressLocality: "Los Angeles", addressRegion: "CA" },
      },
      url: "https://www.replayclub.io/equipment-rental",
    };
    let script = document.getElementById("seo-jsonld") as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = "seo-jsonld";
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(jsonLd);

    return () => {
      document.title = "Replay Club — Recording Studio, Podcast & DJ Booking";
      script?.remove();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between pl-24 sm:pl-28 pr-6 py-4 bg-background/80 backdrop-blur-md border-b border-border/20">
        {/* pl-24/28 reserves room for the floating SiteMenu cluster (top-3 left-3 z-51) */}
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2">
            <BrandLogo className="w-8 h-8 rounded-full" />
            <span className="font-display text-sm font-bold text-foreground hidden sm:inline">Replay Club</span>
          </Link>
        </div>
      </nav>

      {/* Hero — DB-driven when images present, hardcoded fallback otherwise */}
      {useDb ? (
        <>
          <div className="h-16" />
          <BookingTabImagesRenderer
            variant={variant}
            images={tabImages}
            alt="Equipment Rental"
          />
          <section className="px-6 pt-10 pb-2 text-center">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[10px] font-body uppercase tracking-[0.25em] text-muted-foreground mb-2"
            >
              Replay Club
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-display text-3xl md:text-5xl font-bold chrome-text mb-3"
            >
              Equipment Rental
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm md:text-base font-body text-muted-foreground max-w-xl mx-auto"
            >
              Professional-grade DJ, camera, audio, and lighting gear available for daily rental. Pick up and drop off at our Los Angeles studio.
            </motion.p>
          </section>
        </>
      ) : (
        <section className="relative h-[50vh] min-h-[350px] overflow-hidden">
          <OptimizedImage
            src={equipmentImg}
            alt="Equipment Rental"
            className="absolute inset-0 w-full h-full object-cover opacity-50"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="relative z-10 flex flex-col items-center justify-end h-full pb-12 px-6 text-center">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-[10px] font-body uppercase tracking-[0.25em] text-muted-foreground mb-2"
            >
              Replay Club
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="font-display text-3xl md:text-5xl font-bold chrome-text mb-3"
            >
              Equipment Rental
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="text-sm md:text-base font-body text-muted-foreground max-w-xl"
            >
              Professional-grade DJ, camera, audio, and lighting gear available for daily rental. Pick up and drop off at our Los Angeles studio.
            </motion.p>
          </div>
        </section>
      )}

      {/* Cart + Equipment Grid */}
      <Suspense fallback={<div className="min-h-[400px]" />}>
        <EquipmentRentalCart />
      </Suspense>

      {/* FAQ */}
      <section className="py-16 px-6">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-display text-xl md:text-2xl font-bold text-foreground mb-8 text-center">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {[
              { question: "What's the rental period?", answer: "All rentals are priced per day (24 hours). Save 10% on 3-day rentals and 20% on 7-day rentals!" },
              { question: "Is there a deposit required?", answer: "Yes, a refundable security deposit is required at pickup. The amount varies by equipment value." },
              { question: "Can I get delivery?", answer: "Pickup and drop-off is at our Los Angeles studio. Local delivery may be arranged for an additional fee." },
              { question: "What if something breaks?", answer: "Normal wear and tear is covered. Damage or loss beyond normal use will be charged against the security deposit." },
            ].map((faq, i) => (
              <motion.details
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="group rounded-lg border border-border/30 bg-card/30 overflow-hidden"
              >
                <summary className="cursor-pointer px-5 py-4 font-display text-sm font-semibold text-foreground list-none flex items-center justify-between">
                  {faq.question}
                  <span className="text-muted-foreground group-open:rotate-45 transition-transform duration-200 text-lg">+</span>
                </summary>
                <p className="px-5 pb-4 text-xs font-body text-muted-foreground leading-relaxed">
                  {faq.answer}
                </p>
              </motion.details>
            ))}
          </div>
        </div>
      </section>

      {/* Location */}
      <section className="py-16 px-6 bg-card/20">
        <div className="max-w-xl mx-auto text-center">
          <MapPin className="w-5 h-5 text-primary mx-auto mb-3" />
          <p className="text-xs font-body text-muted-foreground uppercase tracking-widest mb-2">Located in</p>
          <p className="font-display text-lg font-bold text-foreground mb-6">Los Angeles, CA</p>
        </div>
      </section>

      {/* Footer back link removed — single back button lives in the header. */}
    </div>
  );
};

export default EquipmentRental;
