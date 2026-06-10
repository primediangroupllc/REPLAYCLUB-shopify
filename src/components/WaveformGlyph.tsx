import { motion, useReducedMotion } from "framer-motion";

interface WaveformGlyphProps {
  /** Peak envelope, values 0–1. */
  peaks: number[];
  className?: string;
  /** Track height in viewBox units. */
  height?: number;
  /** Draw-in reveal on scroll into view (honors prefers-reduced-motion). */
  animate?: boolean;
}

/**
 * Pure SVG waveform — renders a real peak envelope as mirrored chrome bars.
 * No audio, no fetch, no state beyond a reduced-motion check. Used by the
 * homepage Mixes section to draw a real mix's shape from snapshotted peaks.
 */
export default function WaveformGlyph({
  peaks,
  className,
  height = 56,
  animate = true,
}: WaveformGlyphProps) {
  const reduce = useReducedMotion();
  const shouldAnimate = animate && !reduce;
  const barW = 2;
  const step = barW + 1.4;
  const width = Math.max(1, peaks.length) * step;
  const mid = height / 2;

  return (
    <motion.div
      className={className}
      initial={shouldAnimate ? { clipPath: "inset(0 100% 0 0)" } : undefined}
      whileInView={shouldAnimate ? { clipPath: "inset(0 0 0 0)" } : undefined}
      viewport={{ once: true, margin: "-12%" }}
      transition={{ duration: 0.9, ease: "easeOut" }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full h-full"
        role="img"
        aria-label="Waveform of the example mix"
      >
        <defs>
          <linearGradient id="wf-chrome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(0 0% 92%)" />
            <stop offset="50%" stopColor="hsl(0 0% 52%)" />
            <stop offset="100%" stopColor="hsl(0 0% 80%)" />
          </linearGradient>
        </defs>
        <g fill="url(#wf-chrome)">
          {peaks.map((p, i) => {
            const clamped = Math.max(0, Math.min(1, p));
            const h = Math.max(1.5, clamped * (height - 2));
            return (
              <rect
                key={i}
                x={i * step}
                y={mid - h / 2}
                width={barW}
                height={h}
                rx={0.75}
              />
            );
          })}
        </g>
      </svg>
    </motion.div>
  );
}
