import { useState, useEffect, useRef, useCallback } from "react";
import { motion, LayoutGroup } from "framer-motion";

interface HaloNavProps {
  tabs: { title: string; mobileLabel?: string; displayLabel?: string }[];
  selectedTab: string;
  onTabSelect: (title: string) => void;
}

const HaloNav = ({ tabs, selectedTab, onTabSelect }: HaloNavProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const rotationRef = useRef(0);
  const rafRef = useRef<number>(0);
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const [ready, setReady] = useState(false);
  const firstFrameRef = useRef(false);

  const count = tabs.length;

  const getRadius = () => {
    if (typeof window === "undefined") return 280;
    const w = window.innerWidth;
    if (w < 640) return 155;   // phone
    if (w < 1024) return 220;  // tablet
    return 280;                // desktop
  };

  const radiusRef = useRef(getRadius());

  useEffect(() => {
    const onResize = () => { radiusRef.current = getRadius(); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Use rAF with direct DOM manipulation instead of React state
  const animate = useCallback(() => {
    if (!isHovered) {
      rotationRef.current += 0.12;
    }

    buttonsRef.current.forEach((btn, i) => {
      if (!btn) return;
      const baseAngle = (360 / count) * i;
      const angle = baseAngle + rotationRef.current;
      const rad = ((angle - 90) * Math.PI) / 180;
      const x = Math.cos(rad) * radiusRef.current;
      const yMultiplier = typeof window !== "undefined" && window.innerWidth < 640 ? 0.7 : 0.45;
      const y = Math.sin(rad) * (radiusRef.current * yMultiplier);

      const isSelected = selectedTab === tabs[i]?.title;
      const depthScale = 0.7 + 0.3 * ((1 - Math.sin(rad)) / 2);
      const depthOpacity = 0.3 + 0.7 * ((1 - Math.sin(rad)) / 2);

      btn.style.transform = `translate(${x}px, ${y}px) scale(${isSelected ? 1.2 : depthScale})`;
      btn.style.opacity = `${isSelected ? 1 : depthOpacity}`;
      btn.style.zIndex = `${isSelected ? 10 : Math.round(depthOpacity * 5)}`;

      if (!firstFrameRef.current) {
        btn.style.visibility = 'visible';
      }
    });

    firstFrameRef.current = true;

    rafRef.current = requestAnimationFrame(animate);
  }, [isHovered, count, selectedTab, tabs]);

  useEffect(() => {
    // Small delay to let buttons mount
    const timer = setTimeout(() => setReady(true), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animate, ready]);

  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <LayoutGroup>
        {tabs.map((tab, i) => {
          const isSelected = selectedTab === tab.title;

          return (
            <button
              key={tab.title}
              ref={(el) => { buttonsRef.current[i] = el; }}
              onClick={() => onTabSelect(tab.title)}
              style={{ visibility: 'hidden' }}
              // Identical sizing for every orbit tab: same px, py, font-size, weight,
              // tracking, min-width, and text-align. Selected state changes ONLY the
              // glow + scale (handled in the rAF loop) — never dimensions.
              className={`halo-tab absolute inline-flex items-center justify-center text-xs sm:text-sm lg:text-base uppercase tracking-[0.12em] px-3 sm:px-4 py-[6px] sm:py-[8px] rounded-full whitespace-nowrap pointer-events-auto cursor-pointer font-bold chrome-text will-change-transform font-mono [text-shadow:_0_0_1px_hsl(0_0%_85%/0.6),_0_1px_2px_hsl(0_0%_0%/0.8)] sm:[text-shadow:none] min-w-[88px] sm:min-w-[112px] lg:min-w-[140px] text-center leading-none ${
                isSelected
                  ? "drop-shadow-[0_0_4px_hsl(0_0%_70%/0.25)]"
                  : "opacity-70 hover:opacity-100"
              }`}
            >
              <span className="sm:hidden">{tab.mobileLabel || tab.displayLabel || tab.title}</span>
              <span className="hidden sm:inline">{tab.displayLabel || tab.title}</span>
            </button>
          );
        })}
      </LayoutGroup>
    </div>
  );
};

export default HaloNav;
