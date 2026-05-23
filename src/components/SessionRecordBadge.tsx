import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, ChevronRight } from "lucide-react";
import replayLogo from "@/assets/logo.png";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Tier =
  | "New Member"
  | "Bronze"
  | "Silver"
  | "Gold"
  | "Platinum"
  | "Diamond"
  | "Obsidian";

interface SessionRecordBadgeProps {
  tier: Tier | string;
  bookingCount: number;
  sessionsToNext: number;
  nextTier: string;
  size?: number; // px, default 64
}

interface TierStyle {
  vinyl: string; // base disc gradient
  vinylConic: string; // grooved conic overlay (premium reflectivity)
  vinylSheen: string; // top-left highlight tint
  label: string; // gradient stops for the center label
  labelText: string;
  labelRing: string; // inner gold/silver ring around label
  ring: string; // outer ring stroke + accent color
  ringGlow: string; // box-shadow color
  grooves: number;
  spinSeconds: number;
  tagline: string;
  caption: string;
}

const TIER_STYLES: Record<string, TierStyle> = {
  "New Member": {
    vinyl: "radial-gradient(circle at 50% 50%, hsl(0,0%,10%) 0%, hsl(0,0%,3%) 100%)",
    vinylConic:
      "conic-gradient(from 0deg, hsla(0,0%,100%,0.04), transparent 25%, hsla(0,0%,100%,0.04) 50%, transparent 75%, hsla(0,0%,100%,0.04))",
    vinylSheen: "hsla(0,0%,100%,0.05)",
    label: "linear-gradient(135deg, hsl(0,0%,28%), hsl(0,0%,16%))",
    labelText: "hsl(0,0%,82%)",
    labelRing: "hsla(0,0%,100%,0.08)",
    ring: "hsla(0,0%,100%,0.18)",
    ringGlow: "hsla(0,0%,100%,0.05)",
    grooves: 3,
    spinSeconds: 24,
    tagline: "First spin awaits.",
    caption: "Test pressing · unreleased",
  },
  Bronze: {
    vinyl:
      "radial-gradient(circle at 50% 50%, hsl(20,30%,12%) 0%, hsl(15,40%,4%) 100%)",
    vinylConic:
      "conic-gradient(from 45deg, hsla(28,80%,55%,0.18), transparent 30%, hsla(28,60%,45%,0.12) 60%, transparent 90%)",
    vinylSheen: "hsla(28,80%,55%,0.18)",
    label: "linear-gradient(135deg, hsl(25,75%,48%), hsl(15,70%,28%))",
    labelText: "hsl(30,90%,92%)",
    labelRing: "hsla(28,90%,70%,0.4)",
    ring: "hsl(28,75%,55%)",
    ringGlow: "hsla(28,75%,55%,0.45)",
    grooves: 4,
    spinSeconds: 16,
    tagline: "Test pressing — you're cutting your sound.",
    caption: "Limited 12\" · Bronze stamp",
  },
  Silver: {
    vinyl:
      "radial-gradient(circle at 50% 50%, hsl(220,5%,20%) 0%, hsl(220,10%,5%) 100%)",
    vinylConic:
      "conic-gradient(from 90deg, hsla(0,0%,100%,0.22), transparent 25%, hsla(220,5%,80%,0.14) 50%, transparent 75%, hsla(0,0%,100%,0.18))",
    vinylSheen: "hsla(0,0%,100%,0.22)",
    label: "linear-gradient(135deg, hsl(220,6%,78%), hsl(220,10%,42%))",
    labelText: "hsl(220,12%,10%)",
    labelRing: "hsla(220,5%,90%,0.5)",
    ring: "hsl(220,5%,80%)",
    ringGlow: "hsla(220,10%,75%,0.5)",
    grooves: 5,
    spinSeconds: 12,
    tagline: "Stamped & polished. Crowd's catching on.",
    caption: "Silver edition · 180g",
  },
  Gold: {
    vinyl:
      "radial-gradient(circle at 50% 50%, hsl(40,40%,14%) 0%, hsl(35,55%,4%) 100%)",
    vinylConic:
      "conic-gradient(from 0deg, hsla(45,95%,65%,0.28), transparent 22%, hsla(40,80%,50%,0.16) 50%, transparent 78%, hsla(45,95%,65%,0.24))",
    vinylSheen: "hsla(45,95%,65%,0.28)",
    label: "linear-gradient(135deg, hsl(45,92%,62%), hsl(35,85%,32%))",
    labelText: "hsl(30,80%,10%)",
    labelRing: "hsla(45,95%,75%,0.55)",
    ring: "hsl(45,90%,58%)",
    ringGlow: "hsla(45,90%,58%,0.6)",
    grooves: 5,
    spinSeconds: 9,
    tagline: "Headliner status. The room's yours.",
    caption: "Gold press · numbered run",
  },
  Platinum: {
    vinyl:
      "radial-gradient(circle at 50% 50%, hsl(260,25%,18%) 0%, hsl(280,40%,5%) 100%)",
    vinylConic:
      "conic-gradient(from 60deg, hsla(285,90%,78%,0.32), transparent 22%, hsla(265,75%,55%,0.18) 50%, transparent 78%, hsla(285,90%,78%,0.28))",
    vinylSheen: "hsla(285,90%,78%,0.30)",
    label: "linear-gradient(135deg, hsl(285,82%,72%), hsl(265,72%,40%))",
    labelText: "hsl(285,30%,98%)",
    labelRing: "hsla(285,90%,85%,0.55)",
    ring: "hsl(285,85%,70%)",
    ringGlow: "hsla(285,85%,70%,0.65)",
    grooves: 6,
    spinSeconds: 7,
    tagline: "Resident legend. Replay Club hall of fame.",
    caption: "Platinum acetate · 1 of 1",
  },
  Diamond: {
    vinyl:
      "radial-gradient(circle at 50% 50%, hsl(195,40%,20%) 0%, hsl(210,55%,4%) 100%)",
    vinylConic:
      "conic-gradient(from 30deg, hsla(190,100%,85%,0.40), transparent 18%, hsla(210,90%,70%,0.22) 36%, transparent 54%, hsla(190,100%,85%,0.36) 72%, transparent 90%)",
    vinylSheen: "hsla(190,100%,90%,0.36)",
    label:
      "linear-gradient(135deg, hsl(190,90%,82%), hsl(210,85%,55%) 50%, hsl(220,70%,30%))",
    labelText: "hsl(210,40%,98%)",
    labelRing: "hsla(190,100%,90%,0.65)",
    ring: "hsl(190,95%,72%)",
    ringGlow: "hsla(190,95%,72%,0.75)",
    grooves: 7,
    spinSeconds: 6,
    tagline: "Crystal cut. The booth bends to you.",
    caption: "Diamond etch · brilliant series",
  },
  Obsidian: {
    vinyl:
      "radial-gradient(circle at 50% 50%, hsl(0,0%,8%) 0%, hsl(0,0%,0%) 100%)",
    vinylConic:
      "conic-gradient(from 0deg, hsla(0,0%,100%,0.55), transparent 12%, hsla(0,0%,100%,0.20) 25%, transparent 38%, hsla(0,0%,100%,0.45) 50%, transparent 62%, hsla(0,0%,100%,0.18) 75%, transparent 88%, hsla(0,0%,100%,0.40))",
    vinylSheen: "hsla(0,0%,100%,0.45)",
    label:
      "linear-gradient(135deg, hsl(0,0%,18%), hsl(0,0%,4%) 50%, hsl(0,0%,12%))",
    labelText: "hsl(0,0%,98%)",
    labelRing: "hsla(0,0%,100%,0.85)",
    ring: "hsl(0,0%,98%)",
    ringGlow: "hsla(0,0%,100%,0.9)",
    grooves: 8,
    spinSeconds: 5,
    tagline: "Mythic status. Carved from the abyss itself.",
    caption: "Obsidian master · forever pressed",
  },
};

const TIER_ORDER: Tier[] = [
  "New Member",
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "Diamond",
  "Obsidian",
];

const TIER_MIN: Record<Tier, number> = {
  "New Member": 0,
  Bronze: 3,
  Silver: 5,
  Gold: 10,
  Platinum: 20,
  Diamond: 50,
  Obsidian: 100,
};

const SessionRecordBadge = ({
  tier,
  bookingCount,
  sessionsToNext,
  nextTier,
  size = 64,
}: SessionRecordBadgeProps) => {
  const style = TIER_STYLES[tier] || TIER_STYLES["New Member"];
  const [hovered, setHovered] = useState(false);
  const isNewMember = tier === "New Member";
  const isApex = tier === "Obsidian";

  const totalForCurrent =
    sessionsToNext > 0 ? bookingCount + sessionsToNext : bookingCount;
  const progress =
    sessionsToNext > 0 && totalForCurrent > 0
      ? Math.min(1, bookingCount / totalForCurrent)
      : 1;
  const circumference = 2 * Math.PI * (size / 2 - 2);
  const dashOffset = circumference * (1 - progress);

  const labelSize = size * 0.42;
  const spindleSize = Math.max(4, size * 0.08);
  const labelRingSize = labelSize + size * 0.06;

  const recordContent = (
    <motion.div
      className="relative cursor-pointer select-none"
      style={{
        width: size,
        height: size,
        perspective: size * 6,
        transformStyle: "preserve-3d",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileTap={{ scale: 0.95 }}
      animate={{
        rotateX: hovered ? -14 : -6,
        rotateY: hovered ? 10 : 4,
        scale: hovered ? 1.08 : 1,
        filter: hovered
          ? `drop-shadow(0 0 22px ${style.ringGlow}) drop-shadow(0 8px 14px rgba(0,0,0,0.7))`
          : `drop-shadow(0 0 8px ${style.ringGlow}) drop-shadow(0 5px 10px rgba(0,0,0,0.55))`,
      }}
      transition={{ type: "spring", stiffness: 220, damping: 18 }}
    >
      {/* 3D edge — disc thickness, sits behind the face */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 60%, hsl(0,0%,3%) 0%, hsl(0,0%,0%) 70%)`,
          transform: `translateZ(-${Math.max(2, size * 0.04)}px)`,
          boxShadow: `inset 0 -2px 4px hsla(0,0%,0%,0.9), 0 0 0 1px hsla(0,0%,0%,0.8)`,
        }}
      />

      {/* Outer chrome bezel */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: `conic-gradient(from 0deg, ${style.ring}, hsla(0,0%,100%,0.25), ${style.ring}, hsla(0,0%,0%,0.5), ${style.ring}, hsla(0,0%,100%,0.18), ${style.ring})`,
          padding: 1,
          maskImage:
            "radial-gradient(circle, transparent calc(100% - 2.5px), black calc(100% - 2.5px))",
          WebkitMaskImage:
            "radial-gradient(circle, transparent calc(100% - 2.5px), black calc(100% - 2.5px))",
          opacity: 0.95,
        }}
      />

      {/* Spinning vinyl */}
      <motion.div
        className="absolute inset-0 rounded-full overflow-hidden"
        style={{
          background: style.vinyl,
          boxShadow: `inset 0 0 ${size * 0.2}px rgba(0,0,0,0.9), inset 0 ${size * 0.04}px ${size * 0.08}px hsla(0,0%,100%,0.04), inset 0 -${size * 0.04}px ${size * 0.08}px hsla(0,0%,0%,0.5), 0 0 0 1px ${style.ring}`,
          transform: "translateZ(0.5px)",
        }}
        animate={{ rotate: 360 }}
        transition={{
          duration: hovered ? Math.max(2, style.spinSeconds / 4) : style.spinSeconds,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        {/* Conic reflective sweep */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none mix-blend-overlay"
          style={{ background: style.vinylConic }}
        />

        {/* Concentric grooves */}
        {Array.from({ length: style.grooves }).map((_, i) => {
          const inset = ((i + 1) / (style.grooves + 1)) * (size * 0.42);
          return (
            <div
              key={`groove-${i}`}
              className="absolute rounded-full pointer-events-none"
              style={{
                top: inset,
                left: inset,
                right: inset,
                bottom: inset,
                border: `1px solid hsla(0,0%,100%,0.06)`,
                boxShadow: `inset 0 0 1px hsla(0,0%,0%,0.6), 0 0 0.5px hsla(0,0%,0%,0.5)`,
              }}
            />
          );
        })}

        {/* Label ring (metallic halo around the label) */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            top: `calc(50% - ${labelRingSize / 2}px)`,
            left: `calc(50% - ${labelRingSize / 2}px)`,
            width: labelRingSize,
            height: labelRingSize,
            border: `1px solid ${style.labelRing}`,
            boxShadow: `0 0 5px ${style.labelRing}, inset 0 0 2px hsla(0,0%,0%,0.5)`,
          }}
        />

        {/* Center label with embedded Replay Club logo */}
        <div
          className="absolute rounded-full flex items-center justify-center overflow-hidden"
          style={{
            top: `calc(50% - ${labelSize / 2}px)`,
            left: `calc(50% - ${labelSize / 2}px)`,
            width: labelSize,
            height: labelSize,
            background: style.label,
            boxShadow: `0 0 0 1px hsla(0,0%,0%,0.55), inset 0 0 ${labelSize * 0.3}px hsla(0,0%,0%,0.4), inset 0 1px 0 hsla(0,0%,100%,0.22), inset 0 -1px 0 hsla(0,0%,0%,0.4)`,
          }}
        >
          {/* Logo — printed on the label like a real record sticker */}
          <img
            src={replayLogo}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="absolute pointer-events-none select-none"
            style={{
              width: "78%",
              height: "78%",
              objectFit: "contain",
              opacity: 0.92,
              filter: `drop-shadow(0 1px 1px hsla(0,0%,0%,0.6)) brightness(1.05)`,
              mixBlendMode: "screen",
            }}
          />
          {/* Subtle radial vignette on the label */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(circle at 30% 25%, hsla(0,0%,100%,0.2) 0%, transparent 55%), radial-gradient(circle at 50% 50%, transparent 50%, hsla(0,0%,0%,0.3) 100%)`,
            }}
          />
        </div>

        {/* Spindle hole with rim */}
        <div
          className="absolute rounded-full"
          style={{
            top: `calc(50% - ${spindleSize / 2}px)`,
            left: `calc(50% - ${spindleSize / 2}px)`,
            width: spindleSize,
            height: spindleSize,
            background:
              "radial-gradient(circle, hsl(0,0%,1%) 0%, hsl(0,0%,6%) 100%)",
            boxShadow:
              "inset 0 0 3px rgba(0,0,0,1), inset 0 1px 1px hsla(0,0%,100%,0.1), 0 0 0 0.5px hsla(0,0%,100%,0.25)",
          }}
        />
      </motion.div>

      {/* Static specular highlight — orbits OPPOSITE to spin for a "fixed light source" feel */}
      <motion.div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 60% 35% at 30% 20%, ${style.vinylSheen} 0%, transparent 60%)`,
          mixBlendMode: "screen",
          transform: "translateZ(1px)",
        }}
        animate={{ opacity: hovered ? [0.85, 1, 0.85] : 0.7 }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Top-edge gloss — gives the disc a "wet" 3D dome feel */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: `linear-gradient(180deg, hsla(0,0%,100%,0.18) 0%, transparent 35%, transparent 65%, hsla(0,0%,0%,0.25) 100%)`,
          transform: "translateZ(1.5px)",
        }}
      />

      {/* Progress ring */}
      {!isNewMember && (
        <svg
          className="absolute inset-0 pointer-events-none"
          width={size}
          height={size}
          style={{ transform: "rotate(-90deg)" }}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={size / 2 - 2}
            fill="none"
            stroke={style.ring}
            strokeOpacity={0.85}
            strokeWidth={1.5}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.8s ease" }}
          />
        </svg>
      )}

      {/* Apex pulse — Obsidian gets its own ambient glow */}
      {isApex && (
        <motion.div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            boxShadow: `0 0 24px ${style.ringGlow}, inset 0 0 12px hsla(0,0%,100%,0.15)`,
          }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* New member sparkle */}
      {isNewMember && (
        <motion.div
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
          style={{
            background:
              "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)",
          }}
          animate={{ scale: [1, 1.4, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Sparkles className="w-2.5 h-2.5 text-primary-foreground" />
        </motion.div>
      )}
    </motion.div>
  );

  return (
    <Popover>
      <PopoverTrigger asChild>{recordContent}</PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="w-[280px] p-3 bg-popover border-border space-y-2"
      >
        <div className="flex items-center justify-between">
          <p
            className="text-[11px] font-display uppercase tracking-widest font-semibold"
            style={{ color: style.ring }}
          >
            {tier}
          </p>
          <span className="text-[9px] text-muted-foreground font-body italic">
            {style.caption}
          </span>
        </div>

        <p className="text-[12px] font-body text-foreground/90 leading-snug">
          {style.tagline}
        </p>

        {/* Tier ladder */}
        <div className="pt-1 space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
          {TIER_ORDER.map((t) => {
            const tStyle = TIER_STYLES[t];
            const isCurrent = t === tier;
            const earned = bookingCount >= TIER_MIN[t];
            return (
              <div
                key={t}
                className={`flex items-center gap-2 text-[10px] font-display uppercase tracking-wider transition-opacity ${
                  isCurrent
                    ? "opacity-100"
                    : earned
                      ? "opacity-70"
                      : "opacity-40"
                }`}
              >
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    background: tStyle.ring,
                    boxShadow: isCurrent ? `0 0 6px ${tStyle.ringGlow}` : "none",
                  }}
                />
                <span
                  className="flex-1"
                  style={{ color: isCurrent ? tStyle.ring : undefined }}
                >
                  {t}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {TIER_MIN[t]}+
                </span>
                {isCurrent && (
                  <ChevronRight className="w-3 h-3" style={{ color: tStyle.ring }} />
                )}
              </div>
            );
          })}
        </div>

        {sessionsToNext > 0 && (
          <p className="text-[10px] text-muted-foreground font-body pt-1 border-t border-border">
            <span className="text-foreground font-semibold">{sessionsToNext}</span> more
            session{sessionsToNext !== 1 ? "s" : ""} to press your{" "}
            <span style={{ color: TIER_STYLES[nextTier]?.ring || "inherit" }}>
              {nextTier}
            </span>{" "}
            record.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default SessionRecordBadge;
