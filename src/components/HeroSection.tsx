import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import logoPng from "@/assets/logo.png";
import logoHeroWebm from "@/assets/logo-hero.webm";
import HaloNav from "@/components/HaloNav";

interface HeroSectionProps {
  onBookClick: () => void;
  isLoggedIn: boolean;
  haloTabs?: { title: string; mobileLabel?: string; displayLabel?: string }[];
  selectedTab?: string;
  onTabSelect?: (title: string) => void;
}

const HeroSection = ({ onBookClick, isLoggedIn, haloTabs, selectedTab, onTabSelect }: HeroSectionProps) => {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // Video sparkle overlay disabled 2026-05-12 — Brian wants a clean
  // static chrome logo without the animated sparkle dots that the
  // .webm bakes in. Re-enable by removing this `false` and the gate
  // below, OR by replacing logo-hero.webm with a clean-sparkle version.
  const [showVideo, setShowVideo] = useState(false);
  const videoEnabled = false;

  // Mouse-driven 3D tilt on the hero logo. Only active on hover-capable
  // pointers (desktop). Touch devices fall back to CSS "breathe" rotation
  // defined in index.css. Reduced-motion users get neither.
  const tiltContainerRef = useRef<HTMLDivElement | null>(null);
  const tiltStyleRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const container = tiltContainerRef.current;
    const target = tiltStyleRef.current;
    if (!container || !target) return;
    // Only run on hover-capable devices that don't request reduced motion.
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if (!window.matchMedia("(hover: hover)").matches) return;
    }
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        target.style.transform = `perspective(1200px) rotateY(${x * 8}deg) rotateX(${-y * 6}deg)`;
      });
    };
    const onLeave = () => {
      cancelAnimationFrame(raf);
      target.style.transform = "";
    };
    container.addEventListener("mousemove", onMove);
    container.addEventListener("mouseleave", onLeave);
    return () => {
      container.removeEventListener("mousemove", onMove);
      container.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  const handleVideoReady = useCallback(() => {
    const video = videoRef.current;

    if (!video) return;

    requestAnimationFrame(() => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 2;
        canvas.height = 2;

        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return;

        context.drawImage(video, 0, 0, 2, 2);
        const pixels = context.getImageData(0, 0, 2, 2).data;

        let transparentPixels = 0;
        let brightPixels = 0;

        for (let index = 0; index < pixels.length; index += 4) {
          const red = pixels[index];
          const green = pixels[index + 1];
          const blue = pixels[index + 2];
          const alpha = pixels[index + 3];

          if (alpha < 16) transparentPixels += 1;
          if (alpha > 240 && red > 240 && green > 240 && blue > 240) brightPixels += 1;
        }

        setShowVideo(transparentPixels > 0 || brightPixels === 0);
      } catch {
        setShowVideo(false);
      }
    });
  }, []);

  return (
    <section className="relative h-screen min-h-[600px] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-background" />

      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
        <div className="relative -mb-4 hero-logo-stage">
          <div
            ref={tiltContainerRef}
            className="relative z-10 cursor-pointer hero-logo-lock"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            <div ref={tiltStyleRef} className="hero-tilt">
              <div className="relative w-full max-w-xl md:max-w-2xl mx-auto hero-logo-lock">
                <img
                  src={logoPng}
                  alt="Replay Club"
                  width={672}
                  height={378}
                  fetchPriority="high"
                  className={`hero-logo-lock w-full h-auto mx-auto object-contain transition-opacity duration-200 ${showVideo ? "opacity-0" : "opacity-100 drop-shadow-2xl"}`}
                />
                {videoEnabled && (
                  <video
                    ref={videoRef}
                    src={logoHeroWebm}
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="auto"
                    // @ts-expect-error fetchPriority is supported in Chrome/Edge/Safari but not yet in TS DOM lib
                    fetchpriority="high"
                    aria-hidden="true"
                    onLoadedData={handleVideoReady}
                    className={`hero-logo-lock absolute inset-0 w-full h-full object-contain pointer-events-none transition-opacity duration-200 ${showVideo ? "opacity-100 drop-shadow-2xl" : "opacity-0"}`}
                    style={{ backgroundColor: "transparent" }}
                  />
                )}
              </div>
            </div>
          </div>

          {haloTabs && onTabSelect && (
            <div className="hero-orbit-layer" aria-hidden={false}>
              <HaloNav
                tabs={haloTabs}
                selectedTab={selectedTab ?? ""}
                onTabSelect={onTabSelect}
              />
            </div>
          )}
        </div>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="text-muted-foreground text-base md:text-lg mb-2 max-w-xl mx-auto font-body tracking-wide"
        >
          {t("hero.welcome")}
        </motion.p>
        <motion.button
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          onClick={onBookClick}
          className="chrome-btn font-display font-semibold text-sm uppercase tracking-[0.15em] px-10 py-4 rounded-md transition-all"
        >
          {isLoggedIn ? t("hero.enter", "ENTER") : t("hero.join")}
        </motion.button>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-chrome-dark to-transparent" />
    </section>
  );
};

export default HeroSection;
