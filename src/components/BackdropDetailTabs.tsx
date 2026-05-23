import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Lightbulb, Clapperboard, CheckCircle2, Clock, Users } from "lucide-react";
import OptimizedImage from "@/components/OptimizedImage";
import blackAbyss from "@/assets/backdrop-black-abyss.webp";
import greenscreen from "@/assets/backdrop-greenscreen.webp";
import officeWhite from "@/assets/backdrop-office-white.webp";
import woodGrid from "@/assets/backdrop-wood-grid.webp";

interface BackdropDetail {
  id: string;
  label: string;
  price: string;
  image: string;
  tagline: string;
  description: string;
  specs: { label: string; value: string }[];
  bestFor: string[];
  lighting: string;
  bookingNotes: string[];
  photographerPackages: { name: string; price: string; includes: string }[];
}

const BACKDROPS: BackdropDetail[] = [
  {
    id: "office-white",
    label: "Office White",
    price: "$15/hr",
    image: officeWhite,
    tagline: "Clean, neutral, ready for anything",
    description:
      "A seamless matte white wall that disappears behind your subject. Perfect for podcasts, interviews, headshots, and product photography where the focus belongs on the talent.",
    specs: [
      { label: "Dimensions", value: "10ft W × 9ft H" },
      { label: "Material", value: "Matte vinyl, non-reflective" },
      { label: "Setup time", value: "Pre-rigged, instant" },
    ],
    bestFor: ["Podcasts & interviews", "Product photography", "Corporate headshots", "Tutorial filming"],
    lighting: "Pairs with our 2× LED panel kit (included). Add a third light to eliminate shadows for product shots.",
    bookingNotes: [
      "Add to any room booking from the Backdrops step",
      "$15/hr — billed per booked hour",
      "Free swap to another backdrop mid-session (15 min reset)",
    ],
    photographerPackages: [
      { name: "Headshot Pack", price: "+$150/hr", includes: "1 photographer · 25 retouched shots · same-day delivery" },
      { name: "Product Pack", price: "+$200/hr", includes: "Photographer + macro lens kit · up to 30 product angles" },
    ],
  },
  {
    id: "wood-grid",
    label: "Wood Grid",
    price: "$20/hr",
    image: woodGrid,
    tagline: "Warm, organic, podcast-ready",
    description:
      "Handcrafted wood-slat panel with vertical grain detail. Adds warmth and depth to any frame while doubling as an acoustic diffuser — a favorite for podcast sets and intimate interviews.",
    specs: [
      { label: "Dimensions", value: "12ft W × 8ft H" },
      { label: "Material", value: "Natural oak slats" },
      { label: "Acoustic", value: "Diffusion-rated, mic-friendly" },
    ],
    bestFor: ["Podcast video sets", "Storytelling interviews", "Lifestyle portraits", "YouTube channels"],
    lighting: "Best with warm 3200K key + soft fill. Side-lighting accentuates the wood grain texture.",
    bookingNotes: [
      "Add to Podcast or Studio Sesh rooms",
      "$20/hr — billed per booked hour",
      "Doubles as acoustic treatment — no extra cost",
    ],
    photographerPackages: [
      { name: "Podcast Visual Pack", price: "+$175/hr", includes: "Photographer + 4K video B-roll · 20 stills · social cuts" },
    ],
  },
  {
    id: "black-abyss",
    label: "Black Abyss",
    price: "$25/hr",
    image: blackAbyss,
    tagline: "Cinematic, moody, infinite",
    description:
      "Floor-to-ceiling matte black with light-absorbing fabric. Creates a true infinite black background — ideal for DJ sets, dramatic portraits, and anything that needs to feel high-end and cinematic.",
    specs: [
      { label: "Dimensions", value: "14ft W × 10ft H" },
      { label: "Material", value: "Light-absorbing matte velvet" },
      { label: "Reflectance", value: "<2% (true black)" },
    ],
    bestFor: ["DJ set videos", "Dramatic portraits", "Music videos", "Brand campaigns"],
    lighting: "Hard rim lighting + smoke creates the iconic Replay Club aesthetic. Smoke machine available on request.",
    bookingNotes: [
      "Most popular for DJ Session bookings",
      "$25/hr — billed per booked hour",
      "Smoke machine add-on available (+$25 flat)",
    ],
    photographerPackages: [
      { name: "DJ Set Pack", price: "+$250/hr", includes: "Photographer + videographer · 4K multi-angle · same-day social edit" },
      { name: "Portrait Pack", price: "+$200/hr", includes: "1 photographer · cinematic lighting · 30 retouched shots" },
    ],
  },
  {
    id: "greenscreen",
    label: "Greenscreen",
    price: "$30/hr",
    image: greenscreen,
    tagline: "Pro chroma-key, livestream-ready",
    description:
      "Broadcast-grade chroma-key green with even lighting and zero hot spots. Built for livestreams, virtual sets, and post-production keying — comp anywhere from a beach to a spaceship.",
    specs: [
      { label: "Dimensions", value: "12ft W × 10ft H" },
      { label: "Material", value: "Pro chroma-key fabric" },
      { label: "Pre-lit", value: "4-point even-wash setup" },
    ],
    bestFor: ["Twitch & YouTube livestreams", "Virtual production", "VFX-heavy shoots", "Music video comps"],
    lighting: "Pre-rigged 4-point even wash to eliminate hotspots and shadows. Add subject backlight to prevent green spill.",
    bookingNotes: [
      "Pairs perfectly with the Livestream room",
      "$30/hr — billed per booked hour",
      "Real-time keying available with our OBS rig",
    ],
    photographerPackages: [
      { name: "Livestream Producer", price: "+$300/hr", includes: "Camera op + real-time keying + scene switching" },
      { name: "VFX Plate Pack", price: "+$225/hr", includes: "Photographer · clean plates · keyed exports delivered" },
    ],
  },
];

interface BackdropDetailTabsProps {
  onBook: () => void;
}

const BackdropDetailTabs = ({ onBook }: BackdropDetailTabsProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialId = searchParams.get("b");
  const [activeId, setActiveId] = useState(
    BACKDROPS.find((b) => b.id === initialId)?.id ?? BACKDROPS[0].id
  );
  const active = BACKDROPS.find((b) => b.id === activeId) ?? BACKDROPS[0];

  // Sync `?b=` query param when user switches tabs (and respect URL changes).
  useEffect(() => {
    const urlId = searchParams.get("b");
    if (urlId && urlId !== activeId && BACKDROPS.find((b) => b.id === urlId)) {
      setActiveId(urlId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSelect = (id: string) => {
    setActiveId(id);
    const next = new URLSearchParams(searchParams);
    next.set("b", id);
    setSearchParams(next, { replace: true });
  };

  // "Book {label}" CTA — open the room selector so the user picks which room
  // to book this backdrop with, then drops into the booking modal directly.
  const handleBookActive = () => {
    navigate("/?selector=1");
    onBook?.();
  };

  return (
    <section className="py-16 px-6 bg-card/20">
      <div className="max-w-5xl mx-auto">
        <h2 className="font-display text-xl md:text-2xl font-bold text-foreground mb-2 text-center">
          Choose Your Backdrop
        </h2>
        <p className="text-xs md:text-sm font-body text-muted-foreground text-center mb-8 max-w-xl mx-auto">
          Tap a backdrop to see specs, lighting notes, photographer packages, and booking details.
        </p>

        {/* Tab triggers */}
        <div
          role="tablist"
          aria-label="Backdrop options"
          className="flex flex-wrap justify-center gap-2 mb-8"
        >
          {BACKDROPS.map((b) => {
            const isActive = b.id === activeId;
            return (
              <button
                key={b.id}
                role="tab"
                aria-selected={isActive}
                aria-controls={`backdrop-panel-${b.id}`}
                id={`backdrop-tab-${b.id}`}
                onClick={() => handleSelect(b.id)}
                className={`min-h-[44px] px-4 py-2 rounded-md font-display text-xs uppercase tracking-[0.15em] font-semibold transition-all border ${
                  isActive
                    ? "chrome-btn text-foreground border-primary/40 shadow-lg"
                    : "bg-card/40 text-muted-foreground border-border/30 hover:border-border/60 hover:text-foreground"
                }`}
              >
                {b.label}
              </button>
            );
          })}
        </div>

        {/* Active panel */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active.id}
            id={`backdrop-panel-${active.id}`}
            role="tabpanel"
            aria-labelledby={`backdrop-tab-${active.id}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="chrome-surface rounded-xl border border-border/30 overflow-hidden"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2">
              {/* Image */}
              <div className="relative aspect-[4/3] lg:aspect-auto lg:min-h-[420px] overflow-hidden bg-card/40">
                <OptimizedImage
                  src={active.image}
                  alt={`${active.label} backdrop`}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-background/40" />
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <p className="text-[10px] font-body uppercase tracking-[0.25em] text-muted-foreground mb-1">
                    {active.tagline}
                  </p>
                  <p className="font-display text-2xl font-bold chrome-text">{active.price}</p>
                </div>
              </div>

              {/* Detail */}
              <div className="p-6 md:p-8 space-y-6">
                <div>
                  <h3 className="font-display text-xl md:text-2xl font-bold text-foreground mb-2">
                    {active.label}
                  </h3>
                  <p className="text-sm font-body text-muted-foreground leading-relaxed">
                    {active.description}
                  </p>
                </div>

                {/* Specs */}
                <div className="grid grid-cols-3 gap-3">
                  {active.specs.map((s) => (
                    <div
                      key={s.label}
                      className="rounded-md border border-border/30 bg-card/30 p-3 text-center"
                    >
                      <p className="text-[9px] font-body uppercase tracking-widest text-muted-foreground mb-1">
                        {s.label}
                      </p>
                      <p className="text-xs font-display font-semibold text-foreground leading-tight">
                        {s.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Best for */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Clapperboard className="w-4 h-4 text-primary" />
                    <h4 className="font-display text-xs uppercase tracking-[0.2em] text-foreground font-semibold">
                      Best For
                    </h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {active.bestFor.map((item) => (
                      <span
                        key={item}
                        className="text-xs font-body text-muted-foreground border border-border/30 bg-card/30 rounded-full px-3 py-1"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Lighting */}
                <div className="rounded-md border border-border/30 bg-card/30 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="w-4 h-4 text-primary" />
                    <h4 className="font-display text-xs uppercase tracking-[0.2em] text-foreground font-semibold">
                      Lighting Notes
                    </h4>
                  </div>
                  <p className="text-xs font-body text-muted-foreground leading-relaxed">
                    {active.lighting}
                  </p>
                </div>
              </div>
            </div>

            {/* Photographer packages */}
            <div className="border-t border-border/30 p-6 md:p-8 bg-card/20">
              <div className="flex items-center gap-2 mb-4">
                <Camera className="w-4 h-4 text-primary" />
                <h4 className="font-display text-xs uppercase tracking-[0.2em] text-foreground font-semibold">
                  Photographer Packages
                </h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {active.photographerPackages.map((pkg) => (
                  <div
                    key={pkg.name}
                    className="rounded-lg border border-border/30 bg-background/40 p-4"
                  >
                    <div className="flex items-baseline justify-between gap-2 mb-2">
                      <p className="font-display text-sm font-bold text-foreground">{pkg.name}</p>
                      <p className="font-display text-sm font-bold chrome-text whitespace-nowrap">
                        {pkg.price}
                      </p>
                    </div>
                    <p className="text-xs font-body text-muted-foreground leading-relaxed">
                      {pkg.includes}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-[10px] font-body uppercase tracking-widest text-muted-foreground mt-4 text-center">
                Or bring your own photographer — no extra fee
              </p>
            </div>

            {/* Booking info + CTA */}
            <div className="border-t border-border/30 p-6 md:p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {active.bookingNotes.map((note, i) => {
                  const Icon = i === 0 ? CheckCircle2 : i === 1 ? Clock : Users;
                  return (
                    <div key={note} className="flex items-start gap-2">
                      <Icon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <span className="text-xs font-body text-muted-foreground leading-relaxed">
                        {note}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-center">
                <button
                  onClick={handleBookActive}
                  className="chrome-btn font-display font-semibold text-xs uppercase tracking-[0.15em] px-8 py-3 rounded-md min-h-[44px]"
                >
                  Book {active.label}
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
};

export default BackdropDetailTabs;