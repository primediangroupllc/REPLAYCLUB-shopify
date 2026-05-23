import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { Fingerprint, Info } from "lucide-react";

const DIMENSION_INFO: Record<string, string> = {
  Energy:
    "Recency-weighted average energy across your mixes (0–100). Newer mixes count more.",
  Transitions:
    "How smoothly tracks blend. Recency-weighted average of each mix's transition score.",
  Creativity:
    "Variation within sets — average standard deviation of each mix's energy profile, scaled to 0–100. Captures real swing, not just one outlier peak.",
  "Genre Range":
    "Breadth of styles you play. 6+ unique genres across your mixes scores 100; below that scales linearly.",
  Consistency:
    "How stable your scores are across mixes. Computed from the standard deviation of overall scores: lower variance = higher consistency.",
  Overall:
    "Recency-weighted average of every mix's overall AI score — your headline number.",
};

interface MixAnalysis {
  overall_score: number;
  transition_score: number;
  energy_score: number;
  genres: string[];
  energy_profile: number[];
}

interface SoundDNAProps {
  analyses: MixAnalysis[];
}

const DIMENSION_COLORS: Record<string, string> = {
  Energy: "hsl(15, 90%, 58%)",
  Transitions: "hsl(195, 85%, 55%)",
  Creativity: "hsl(285, 75%, 62%)",
  "Genre Range": "hsl(50, 90%, 55%)",
  Consistency: "hsl(160, 70%, 50%)",
  Overall: "hsl(var(--primary))",
};

const GENRE_COLORS: Record<string, string> = {
  "deep house": "hsl(195, 85%, 55%)",
  "tech house": "hsl(170, 75%, 50%)",
  house: "hsl(210, 90%, 60%)",
  techno: "hsl(280, 80%, 60%)",
  minimal: "hsl(220, 15%, 65%)",
  trance: "hsl(245, 85%, 65%)",
  progressive: "hsl(255, 75%, 60%)",
  "drum & bass": "hsl(15, 90%, 55%)",
  dnb: "hsl(15, 90%, 55%)",
  jungle: "hsl(95, 70%, 45%)",
  "hip-hop": "hsl(345, 80%, 55%)",
  "hip hop": "hsl(345, 80%, 55%)",
  rap: "hsl(355, 75%, 50%)",
  trap: "hsl(330, 80%, 55%)",
  dubstep: "hsl(140, 80%, 45%)",
  bass: "hsl(125, 75%, 50%)",
  garage: "hsl(50, 90%, 55%)",
  ukg: "hsl(50, 90%, 55%)",
  ambient: "hsl(200, 50%, 70%)",
  downtempo: "hsl(215, 45%, 65%)",
  chillout: "hsl(190, 55%, 65%)",
  disco: "hsl(310, 80%, 60%)",
  "nu-disco": "hsl(295, 75%, 60%)",
  funk: "hsl(25, 90%, 55%)",
  soul: "hsl(35, 80%, 55%)",
  jazz: "hsl(45, 70%, 55%)",
  electronic: "hsl(265, 70%, 60%)",
  edm: "hsl(275, 80%, 60%)",
  pop: "hsl(335, 85%, 65%)",
  "r&b": "hsl(290, 60%, 55%)",
  rnb: "hsl(290, 60%, 55%)",
  reggae: "hsl(110, 65%, 45%)",
  afrobeat: "hsl(30, 85%, 55%)",
  "afro house": "hsl(20, 80%, 55%)",
  latin: "hsl(5, 85%, 55%)",
  "lo-fi": "hsl(225, 40%, 60%)",
  lofi: "hsl(225, 40%, 60%)",
  experimental: "hsl(285, 65%, 55%)",
  breaks: "hsl(60, 80%, 50%)",
  breakbeat: "hsl(60, 80%, 50%)",
  hardstyle: "hsl(0, 90%, 55%)",
  psytrance: "hsl(165, 80%, 45%)",
};

function getGenreColor(genre: string): string {
  if (!genre) return "hsl(220, 15%, 60%)";
  const lower = genre.toLowerCase().trim();
  if (GENRE_COLORS[lower]) return GENRE_COLORS[lower];
  for (const [key, color] of Object.entries(GENRE_COLORS)) {
    if (lower.includes(key)) return color;
  }
  let hash = 0;
  for (let i = 0; i < lower.length; i++) hash = lower.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 70%, 55%)`;
}

const SoundDNA = ({ analyses }: SoundDNAProps) => {
  const [activeDimension, setActiveDimension] = useState<string | null>(null);

  const dna = useMemo(() => {
    if (analyses.length === 0) return null;

    // Recency weighting: newer mixes (later in array as passed) weighted higher.
    // We assume the caller passes oldest-first; if not, weighting is still benign.
    const n = analyses.length;
    const weights = analyses.map((_, i) => 0.5 + (i / Math.max(1, n - 1)) * 0.5);
    const wSum = weights.reduce((a, b) => a + b, 0);
    const wAvg = (vals: number[]) =>
      vals.reduce((acc, v, i) => acc + v * weights[i], 0) / wSum;

    const stdDev = (vals: number[]) => {
      if (vals.length < 2) return 0;
      const m = vals.reduce((a, b) => a + b, 0) / vals.length;
      return Math.sqrt(vals.reduce((a, v) => a + (v - m) ** 2, 0) / vals.length);
    };

    const energy = wAvg(analyses.map((a) => a.energy_score ?? 0));
    const transitions = wAvg(analyses.map((a) => a.transition_score ?? 0));
    const overall = wAvg(analyses.map((a) => a.overall_score ?? 0));

    const allGenres = new Set(analyses.flatMap((a) => a.genres || []));
    // 6 distinct genres = 100; smoother curve than the old ×20 jump
    const genreDiversity = Math.min(100, (allGenres.size / 6) * 100);

    // Consistency: based on stddev of overall scores. 0 stddev = 100, 25+ stddev = 0.
    const overallScores = analyses.map((a) => a.overall_score ?? 0);
    const consistency = Math.max(0, Math.min(100, 100 - stdDev(overallScores) * 4));

    // Creativity: avg of per-mix energy_profile stddev, scaled. Captures real swing.
    const profileStds = analyses
      .map((a) => a.energy_profile)
      .filter((ep): ep is number[] => Array.isArray(ep) && ep.length > 1)
      .map((ep) => stdDev(ep));
    const creativity =
      profileStds.length > 0
        ? Math.min(100, (profileStds.reduce((a, b) => a + b, 0) / profileStds.length) * 4)
        : 60;

    return {
      dimensions: [
        { dimension: "Energy", value: Math.round(energy), fullMark: 100 },
        { dimension: "Transitions", value: Math.round(transitions), fullMark: 100 },
        { dimension: "Creativity", value: Math.round(creativity), fullMark: 100 },
        { dimension: "Genre Range", value: Math.round(genreDiversity), fullMark: 100 },
        { dimension: "Consistency", value: Math.round(consistency), fullMark: 100 },
        { dimension: "Overall", value: Math.round(overall), fullMark: 100 },
      ],
      totalMixes: analyses.length,
      topGenres: Array.from(allGenres).slice(0, 6),
      avgScore: Math.round(overall),
    };
  }, [analyses]);

  if (!dna) {
    return (
      <div className="bg-card border border-border rounded-lg p-5 text-center space-y-2">
        <Fingerprint className="w-8 h-8 mx-auto text-muted-foreground/40" />
        <p className="text-xs font-display uppercase tracking-widest text-muted-foreground">
          Sound DNA
        </p>
        <p className="text-muted-foreground/60 text-[11px] font-body">
          Analyze your mixes to build your sonic fingerprint
        </p>
      </div>
    );
  }

  const activeData = activeDimension
    ? dna.dimensions.find((d) => d.dimension === activeDimension)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-card border border-border rounded-lg p-5 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{
              background:
                "conic-gradient(from 0deg, hsl(15, 90%, 58%), hsl(50, 90%, 55%), hsl(160, 70%, 50%), hsl(195, 85%, 55%), hsl(285, 75%, 62%), hsl(15, 90%, 58%))",
            }}
          >
            <div className="w-[26px] h-[26px] rounded-full bg-card flex items-center justify-center">
              <Fingerprint className="w-3.5 h-3.5 text-foreground" />
            </div>
          </div>
          <div>
            <p className="text-xs font-display uppercase tracking-widest text-foreground font-semibold">
              Sound DNA
            </p>
            <p className="text-[10px] text-muted-foreground font-body">
              Based on {dna.totalMixes} analyzed mix{dna.totalMixes !== 1 ? "es" : ""} · tap a point
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-display font-bold text-primary">{dna.avgScore}</p>
          <p className="text-[9px] text-muted-foreground font-display uppercase tracking-widest">
            Avg Score
          </p>
        </div>
      </div>

      {/* Radar Chart — interactive web */}
      <div className="w-full h-56 -mx-2 relative">
        {/* Static ambient halo (no looping motion) */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "conic-gradient(from 0deg, hsla(15,90%,58%,0.08), hsla(50,90%,55%,0.08), hsla(160,70%,50%,0.08), hsla(195,85%,55%,0.08), hsla(285,75%,62%,0.08), hsla(15,90%,58%,0.08))",
            borderRadius: "50%",
            filter: "blur(24px)",
          }}
        />
        <div
          className="w-full h-full relative"
          style={{
            filter: activeDimension
              ? `drop-shadow(0 0 14px ${
                  DIMENSION_COLORS[activeDimension] || "hsl(var(--primary))"
                }55)`
              : "drop-shadow(0 0 4px hsla(195,85%,55%,0.2))",
            transition: "filter 300ms ease",
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={dna.dimensions} cx="50%" cy="50%" outerRadius="70%">
              <defs>
                <radialGradient id="dna-fill" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="hsl(285, 75%, 62%)" stopOpacity={0.35} />
                  <stop offset="50%" stopColor="hsl(195, 85%, 55%)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="hsl(15, 90%, 58%)" stopOpacity={0.15} />
                </radialGradient>
                <linearGradient id="dna-stroke" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="hsl(15, 90%, 58%)" />
                  <stop offset="33%" stopColor="hsl(50, 90%, 55%)" />
                  <stop offset="66%" stopColor="hsl(195, 85%, 55%)" />
                  <stop offset="100%" stopColor="hsl(285, 75%, 62%)" />
                </linearGradient>
              </defs>
              <PolarGrid stroke="hsl(var(--border))" strokeOpacity={0.55} />
              <PolarAngleAxis
                dataKey="dimension"
                tick={({ payload, x, y, textAnchor, index }) => {
                  const isActive = activeDimension === payload.value;
                  const color =
                    DIMENSION_COLORS[payload.value] || "hsl(var(--muted-foreground))";
                  return (
                    <text
                      key={`tick-${payload.value}-${index}`}
                      x={x}
                      y={y}
                      textAnchor={textAnchor}
                      fontSize={isActive ? 10.5 : 9}
                      fill={color}
                      fontFamily="var(--font-display, sans-serif)"
                      style={{
                        fontWeight: isActive ? 800 : 600,
                        cursor: "pointer",
                        transition: "all 200ms ease",
                      }}
                      onClick={() =>
                        setActiveDimension((prev) =>
                          prev === payload.value ? null : payload.value,
                        )
                      }
                    >
                      {payload.value}
                    </text>
                  );
                }}
              />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
              <Radar
                name="Sound DNA"
                dataKey="value"
                stroke="url(#dna-stroke)"
                fill="url(#dna-fill)"
                fillOpacity={1}
                strokeWidth={2}
                isAnimationActive
                animationDuration={900}
                activeDot={false}
                dot={(props: any) => {
                  const { cx, cy, payload, index } = props;
                  // Guard: Recharts may invoke the dot renderer without a payload
                  // during certain animation phases — that produced the
                  // `dot-undefined` duplicate-key warning.
                  if (cx == null || cy == null || !payload?.dimension) {
                    return <g key={`dot-empty-${index ?? Math.random()}`} />;
                  }
                  const color = DIMENSION_COLORS[payload.dimension] || "hsl(var(--primary))";
                  const isActive = activeDimension === payload.dimension;
                  return (
                    <g
                      key={`dot-${payload.dimension}`}
                      style={{ cursor: "pointer" }}
                      onClick={() =>
                        setActiveDimension((prev) =>
                          prev === payload.dimension ? null : payload.dimension,
                        )
                      }
                    >
                      {/* Larger invisible hit target */}
                      <circle cx={cx} cy={cy} r={14} fill="transparent" />
                      {isActive && (
                        <circle cx={cx} cy={cy} r={11} fill={color} opacity={0.22} />
                      )}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={isActive ? 5.5 : 4}
                        fill={color}
                        stroke="hsl(var(--card))"
                        strokeWidth={1.5}
                        style={{ transition: "r 200ms ease" }}
                      />
                    </g>
                  );
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Active dimension detail panel */}
      <AnimatePresence mode="wait">
        {activeData && (
          <motion.div
            key={activeData.dimension}
            initial={{ opacity: 0, y: 6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -6, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div
              className="rounded-md border p-3 space-y-2"
              style={{
                borderColor:
                  (DIMENSION_COLORS[activeData.dimension] || "hsl(var(--primary))") + "55",
                backgroundColor:
                  (DIMENSION_COLORS[activeData.dimension] || "hsl(var(--primary))") + "10",
              }}
            >
              <div className="flex items-center justify-between">
                <p
                  className="text-[10px] font-display uppercase tracking-widest font-semibold"
                  style={{
                    color:
                      DIMENSION_COLORS[activeData.dimension] || "hsl(var(--primary))",
                  }}
                >
                  {activeData.dimension}
                </p>
                <p
                  className="text-base font-display font-bold"
                  style={{
                    color:
                      DIMENSION_COLORS[activeData.dimension] || "hsl(var(--primary))",
                  }}
                >
                  {activeData.value}
                  <span className="text-[10px] text-muted-foreground font-body ml-0.5">
                    /100
                  </span>
                </p>
              </div>
              <p className="text-[11px] font-body leading-relaxed text-foreground/85">
                {DIMENSION_INFO[activeData.dimension]}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dimension scores grid */}
      <div className="grid grid-cols-3 gap-2">
        {dna.dimensions.map((d) => {
          const color = DIMENSION_COLORS[d.dimension] || "hsl(var(--primary))";
          const isActive = activeDimension === d.dimension;
          return (
            <button
              key={d.dimension}
              type="button"
              onClick={() =>
                setActiveDimension((prev) => (prev === d.dimension ? null : d.dimension))
              }
              className={`text-center space-y-1 rounded-md p-1.5 -m-1 transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                isActive ? "bg-muted/50 scale-[1.02]" : "hover:bg-muted/30"
              }`}
              aria-label={`Toggle ${d.dimension} details`}
              aria-pressed={isActive}
            >
              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${d.value}%` }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                />
              </div>
              <p
                className="text-[9px] font-display uppercase tracking-widest inline-flex items-center gap-0.5 justify-center w-full"
                style={{ color }}
              >
                {d.dimension}
                <Info className="w-2.5 h-2.5 opacity-60" />
              </p>
              <p className="text-xs font-display font-bold text-foreground">{d.value}</p>
            </button>
          );
        })}
      </div>

      {/* Top genres */}
      {dna.topGenres.length > 0 && (
        <div className="pt-1">
          <p className="text-[9px] font-display uppercase tracking-widest text-muted-foreground text-center mb-1.5">
            Top Genres
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center">
            {dna.topGenres.map((genre) => {
              const color = getGenreColor(genre);
              return (
                <span
                  key={genre}
                  className="inline-flex items-center gap-1 text-[10px] font-display uppercase tracking-widest text-foreground/80 capitalize"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: color }}
                    aria-hidden
                  />
                  {genre}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default SoundDNA;
