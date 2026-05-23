import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Camera, Lightbulb, Clapperboard } from "lucide-react";
import blackAbyssImg from "@/assets/backdrop-black-abyss.webp";
import greenscreenImg from "@/assets/backdrop-greenscreen.webp";
import officeWhiteImg from "@/assets/backdrop-office-white.webp";
import woodGridImg from "@/assets/backdrop-wood-grid.webp";
import { type Backdrop, PHOTO_PACKAGES } from "@/lib/bookingConstants";

// Re-export the type so existing imports of `Backdrop` from this module keep working.
export type { Backdrop };

/**
 * BACKDROPS homepage tab — guided 3-stage flow:
 *   1. Intro card with "Browse Backdrops" CTA.
 *   2. Grid of 4 backdrop options.
 *   3. Detail panel for the selected backdrop with "Continue to Booking" CTA
 *      that hands the backdrop name back up to Index.tsx so it pre-loads into
 *      the booking cart.
 */

// Pricing benchmarked against LA backdrop add-on rates (Apr 2026):
// full cyc studios run $80–$150/hr; à-la-carte backdrop add-ons at boutique
// rooms typically range $15–$35/hr. We sit just under market for each type.
export const BACKDROPS: Backdrop[] = [
  {
    name: "Black Abyss Backdrop",
    description: "Floor-to-ceiling matte black velvet drapes for moody, cinematic shoots and DJ sets.",
    priceCents: 2500,
    image: blackAbyssImg,
  },
  {
    name: "Greenscreen Backdrop",
    description: "Pro chroma-key green pull-down for livestreams and post-production keying.",
    priceCents: 3000,
    image: greenscreenImg,
  },
  {
    name: "Office White Backdrop",
    description: "Clean neutral wall — perfect for podcasts, interviews, and product shots.",
    priceCents: 1500,
    image: officeWhiteImg,
  },
  {
    name: "Wood Grid Backdrop",
    description: "Warm wood-slat acoustic panel for a textured, organic look.",
    priceCents: 2000,
    image: woodGridImg,
  },
];

// Per-backdrop detail content for the inline "drill-in" panel.
interface BackdropDetail {
  bestFor: string[];
  lighting: string;
}
const BACKDROP_DETAILS: Record<string, BackdropDetail> = {
  "Black Abyss Backdrop": {
    bestFor: ["DJ set videos", "Dramatic portraits", "Music videos", "Brand campaigns"],
    lighting: "Hard rim lighting + smoke creates the iconic Replay Club aesthetic. Smoke machine available on request.",
  },
  "Greenscreen Backdrop": {
    bestFor: ["Twitch & YouTube livestreams", "Virtual production", "VFX-heavy shoots", "Music video comps"],
    lighting: "Pre-rigged 4-point even wash to eliminate hotspots and shadows. Add subject backlight to prevent green spill.",
  },
  "Office White Backdrop": {
    bestFor: ["Podcasts & interviews", "Product photography", "Corporate headshots", "Tutorial filming"],
    lighting: "Pairs with our 2× LED panel kit (included). Add a third light to eliminate shadows for product shots.",
  },
  "Wood Grid Backdrop": {
    bestFor: ["Podcast video sets", "Storytelling interviews", "Lifestyle portraits", "YouTube channels"],
    lighting: "Best with warm 3200K key + soft fill. Side-lighting accentuates the wood grain texture.",
  },
};

interface BackdropsGalleryProps {
  /** Called when user confirms a backdrop and clicks "Continue to Booking". */
  onContinue: (backdropName: string, photoPackageName?: string | null) => void;
}

type Stage = "intro" | "grid" | "detail";

const BackdropsGallery = ({ onContinue }: BackdropsGalleryProps) => {
  const [stage, setStage] = useState<Stage>("intro");
  const [activeName, setActiveName] = useState<string | null>(null);
  // null = "Self-Service Shoot" (no add-on), otherwise the package name.
  const [selectedPackage, setSelectedPackage] = useState<string | null>("Self-Service Shoot");
  const detailRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const active = BACKDROPS.find((b) => b.name === activeName) ?? null;
  const activeDetail = active ? BACKDROP_DETAILS[active.name] : null;

  // Smooth-scroll helpers so the user always lands on the new section.
  useEffect(() => {
    if (stage === "detail" && detailRef.current) {
      detailRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (stage === "grid" && gridRef.current) {
      gridRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [stage]);

  const handleSelectBackdrop = (name: string) => {
    setActiveName(name);
    setSelectedPackage("Self-Service Shoot");
    setStage("detail");
  };

  return (
    <div className="space-y-8">
      {/* ---------- STAGE 1: Intro (matches RoomCard layout) ---------- */}
      <AnimatePresence mode="wait">
        {stage === "intro" && (
          <motion.section
            key="intro"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3 }}
            onClick={() => setStage("grid")}
            className="card-premium card-shine rounded-lg overflow-hidden group cursor-pointer relative transition-all duration-300"
          >
            {/* Hero image — mirrors RoomCard's h-52 hero */}
            <div className="relative h-52 overflow-hidden">
              <img
                src={blackAbyssImg}
                alt="Replay Club studio backdrops"
                loading="lazy"
                className="w-full h-full object-cover opacity-70 group-hover:opacity-90 group-hover:scale-105 transition-all duration-500"
                style={{ objectPosition: "center 50%" }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
              <span className="absolute top-4 right-4 bg-success/90 text-foreground text-[10px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1.5 backdrop-blur-sm">
                <span className="w-1.5 h-1.5 bg-foreground rounded-full animate-pulse" />
                Available
              </span>
              <span className="absolute top-4 left-4 bg-accent text-accent-foreground text-[10px] font-display font-semibold uppercase tracking-wider px-3 py-1 rounded-full backdrop-blur-sm">
                Add-On
              </span>
            </div>

            {/* Gallery strip — mirrors RoomCard's 2-col gallery */}
            <div className="grid grid-cols-2 gap-px bg-border/20">
              {[greenscreenImg, woodGridImg].map((img, i) => (
                <div key={i} className="relative h-32 overflow-hidden">
                  <img
                    src={img}
                    alt={`Backdrop preview ${i + 1}`}
                    loading="lazy"
                    className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-all duration-500"
                    style={{ objectPosition: "center 50%" }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card/60 to-transparent" />
                </div>
              ))}
            </div>

            {/* Body — mirrors RoomCard's text block */}
            <div className="p-6">
              <p className="text-muted-foreground text-[11px] font-body uppercase tracking-[0.2em] mb-2">
                Studio Add-Ons
              </p>
              <h3 className="font-display text-xl font-bold chrome-text mb-0.5">
                Studio Backdrops
              </h3>
              <p className="text-[10px] font-body text-muted-foreground uppercase tracking-[0.1em] mb-3">
                ​
              </p>
              <p className="text-chrome font-display font-semibold text-sm mb-4">
                $15 – $30 / hr
              </p>

              <p className="text-[10px] font-body text-primary/80 uppercase tracking-[0.15em] mb-3">
                Includes 4 backdrops + optional photographer
              </p>

              <ul className="space-y-2 mb-6">
                {[
                  "4 pro backdrops — Black Abyss, Greenscreen, Office White, Wood Grid",
                  "Hourly add-on pricing — stack onto any studio booking",
                  "Optional photographer packages — Self-Service, Standard, or Premium",
                  "Pre-rigged lighting & acoustic-treated panels",
                ].map((f) => (
                  <li key={f} className="text-muted-foreground text-xs font-body flex items-center gap-2">
                    <span className="w-px h-3 bg-chrome-dark" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setStage("grid"); }}
                className="w-full chrome-btn font-display font-semibold text-xs uppercase tracking-[0.15em] px-6 py-3 rounded-md min-h-[48px] flex items-center justify-center gap-2"
              >
                Browse Backdrops <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ---------- STAGE 2: Grid ---------- */}
      {(stage === "grid" || stage === "detail") && (
        <section ref={gridRef} className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => { setStage("intro"); setActiveName(null); }}
              className="text-xs font-display uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 min-h-[44px]"
            >
              <ArrowLeft className="w-3 h-3" /> Back
            </button>
            <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">
              Step 1 — Pick a backdrop
            </p>
            <div className="w-12" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {BACKDROPS.map((b, i) => {
              const isActive = b.name === activeName;
              return (
                <motion.button
                  type="button"
                  key={b.name}
                  onClick={() => handleSelectBackdrop(b.name)}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  aria-pressed={isActive}
                  className={`group relative text-left rounded-xl overflow-hidden border bg-card/40 backdrop-blur-sm transition-all min-h-[44px] ${
                    isActive
                      ? "border-chrome ring-2 ring-chrome/40"
                      : "border-border/50 hover:border-chrome/60"
                  }`}
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-black">
                    <img
                      src={b.image}
                      alt={`${b.name} installed at Replay Club studio`}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-card/90 via-card/10 to-transparent" />
                    <span className="absolute top-3 right-3 text-[9px] uppercase tracking-[0.2em] font-mono px-2 py-1 rounded-full bg-background/70 backdrop-blur-md border border-chrome/30 text-foreground">
                      {isActive ? "Selected" : "For Rent"}
                    </span>
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="font-display font-semibold text-base text-foreground">
                        {b.name.replace(/ Backdrop$/, "")}
                      </h3>
                      <span className="chrome-text font-mono text-xs whitespace-nowrap">
                        ${(b.priceCents / 100).toFixed(0)}/hr
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-body leading-relaxed">
                      {b.description}
                    </p>
                    <p className={`text-[10px] font-display uppercase tracking-[0.15em] pt-1 flex items-center gap-1 ${isActive ? "text-primary" : "text-muted-foreground/70"}`}>
                      {isActive ? "Tap again to view details" : "Tap to view details"} <ArrowRight className="w-3 h-3" />
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </section>
      )}

      {/* ---------- STAGE 3: Detail panel ---------- */}
      <AnimatePresence>
        {stage === "detail" && active && activeDetail && (
          <motion.section
            ref={detailRef}
            key={`detail-${active.name}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3 }}
            className="chrome-surface rounded-xl border border-border/30 overflow-hidden"
            aria-label={`${active.name} details`}
          >
            <div className="relative aspect-[16/9] overflow-hidden bg-black">
              <img
                src={active.image}
                alt={`${active.name} installed at Replay Club studio`}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <p className="text-[10px] font-body uppercase tracking-[0.25em] text-muted-foreground mb-1">
                  Step 2 — Review & Book
                </p>
                <div className="flex items-end justify-between gap-3">
                  <h3 className="font-display text-xl md:text-2xl font-bold text-foreground">
                    {active.name.replace(/ Backdrop$/, "")}
                  </h3>
                  <span className="chrome-text font-mono text-sm whitespace-nowrap">
                    ${(active.priceCents / 100).toFixed(0)}/hr
                  </span>
                </div>
              </div>
            </div>

            <div className="p-5 md:p-6 space-y-5">
              <p className="text-sm font-body text-muted-foreground leading-relaxed">
                {active.description}
              </p>

              {/* Best for */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Clapperboard className="w-4 h-4 text-primary" />
                  <h4 className="font-display text-xs uppercase tracking-[0.2em] text-foreground font-semibold">Best For</h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeDetail.bestFor.map((item) => (
                    <span key={item} className="text-xs font-body text-muted-foreground border border-border/30 bg-background/40 rounded-full px-3 py-1">
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              {/* Lighting */}
              <div className="rounded-md border border-border/30 bg-background/40 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="w-4 h-4 text-primary" />
                  <h4 className="font-display text-xs uppercase tracking-[0.2em] text-foreground font-semibold">Lighting Notes</h4>
                </div>
                <p className="text-xs font-body text-muted-foreground leading-relaxed">
                  {activeDetail.lighting}
                </p>
              </div>

              {/* Photographer packages */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Camera className="w-4 h-4 text-primary" />
                  <h4 className="font-display text-xs uppercase tracking-[0.2em] text-foreground font-semibold">Photographer Packages</h4>
                </div>
                <div className="space-y-2" role="radiogroup" aria-label="Photographer package">
                  {PHOTO_PACKAGES.map((pkg) => {
                    const isSelected = selectedPackage === pkg.name;
                    const priceLabel = pkg.priceCents === 0 ? "Free" : `+$${(pkg.priceCents / 100).toFixed(0)}`;
                    return (
                      <button
                        type="button"
                        key={pkg.name}
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => setSelectedPackage(pkg.name)}
                        className={`w-full text-left rounded-lg border p-3 transition-all min-h-[44px] ${
                          isSelected
                            ? "border-chrome ring-2 ring-chrome/40 bg-background/60"
                            : "border-border/30 bg-background/40 hover:border-chrome/60"
                        }`}
                      >
                        <div className="flex items-baseline justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <span className={`inline-block w-3 h-3 rounded-full border ${isSelected ? "border-chrome bg-primary" : "border-border"}`} aria-hidden />
                            <p className="font-display text-sm font-bold text-foreground">{pkg.name}</p>
                          </div>
                          <p className="font-display text-xs font-bold chrome-text whitespace-nowrap">{priceLabel}</p>
                        </div>
                        <p className="text-xs font-body text-muted-foreground leading-relaxed pl-5">{pkg.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Continue CTA */}
              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={() => onContinue(active.name, selectedPackage)}
                  className="w-full chrome-btn font-display font-semibold text-xs uppercase tracking-[0.15em] px-6 py-3 rounded-md min-h-[48px] flex items-center justify-center gap-2"
                >
                  Continue to Booking <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <p className="text-[10px] font-body text-muted-foreground/70 text-center">
                  We'll add the {active.name.replace(/ Backdrop$/, "")} backdrop{selectedPackage && selectedPackage !== "Self-Service Shoot" ? ` + ${selectedPackage}` : ""} to your booking — pick your date, time, and any extras next.
                </p>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {stage !== "intro" && (
        <p className="text-[10px] text-muted-foreground/70 text-center font-mono uppercase tracking-[0.2em]">
          More backdrops coming soon
        </p>
      )}
    </div>
  );
};

export default BackdropsGallery;
