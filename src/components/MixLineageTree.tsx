import { useMemo, useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  GitBranch,
  Calendar,
  Music,
  Zap,
  TrendingUp,
  Sparkles,
  Activity,
  Link2,
  ListMusic,
  Gauge,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface MixNode {
  id: string;
  title: string;
  genres: string[];
  primaryGenre: string;
  energy: number;
  overallScore: number;
  date: string;
  transitionScore: number;
  raw: any;
}

interface MixLineageTreeProps {
  mixes: Array<{
    id: string;
    title: string;
    created_at: string;
    recorded_at: string | null;
    mix_analysis: any;
  }>;
}

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

interface SimilarityResult {
  score: number; // 0-100
  label: "Strong" | "Moderate" | "Loose";
  reasons: string[];
  sharedGenres: string[];
}

function computeSimilarity(a: MixNode, b: MixNode): SimilarityResult {
  const reasons: string[] = [];
  const aGenres = new Set(a.genres.map((g) => g.toLowerCase()));
  const bGenres = new Set(b.genres.map((g) => g.toLowerCase()));
  const sharedGenres = [...aGenres].filter((g) => bGenres.has(g));
  const unionSize = new Set([...aGenres, ...bGenres]).size || 1;
  const genreOverlap = sharedGenres.length / unionSize; // 0-1

  const energyDiff = Math.abs(a.energy - b.energy);
  const energyAffinity = Math.max(0, 1 - energyDiff / 50); // 0-1, full at <0 diff

  const scoreDiff = Math.abs(a.overallScore - b.overallScore);
  const scoreAffinity = Math.max(0, 1 - scoreDiff / 50);

  const score = Math.round((genreOverlap * 0.55 + energyAffinity * 0.3 + scoreAffinity * 0.15) * 100);

  if (sharedGenres.length > 0) {
    reasons.push(`${sharedGenres.length} shared genre${sharedGenres.length > 1 ? "s" : ""}`);
  }
  if (energyDiff < 10) reasons.push("similar energy");
  else if (energyDiff < 20) reasons.push("close energy");
  if (scoreDiff < 8) reasons.push("matching quality");

  let label: SimilarityResult["label"] = "Loose";
  if (score >= 60) label = "Strong";
  else if (score >= 30) label = "Moderate";

  return { score, label, reasons, sharedGenres };
}

const MixLineageTree = ({ mixes }: MixLineageTreeProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [selected, setSelected] = useState<MixNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setContainerWidth(e.contentRect.width);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const nodes = useMemo<MixNode[]>(() => {
    return mixes
      .filter((m) => m.mix_analysis)
      .map((m) => {
        const analysis = m.mix_analysis;
        const genres: string[] = analysis.genres || [];
        return {
          id: m.id,
          title: m.title,
          genres,
          primaryGenre: genres[0] || "Unknown",
          energy: analysis.energy_score ?? 50,
          overallScore: analysis.overall_score ?? 50,
          transitionScore: analysis.transition_score ?? 50,
          date: m.recorded_at || m.created_at,
          raw: { ...analysis, _mix: m },
        };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [mixes]);

  if (nodes.length < 2) return null;

  const allGenres = [...new Set(nodes.flatMap((n) => n.genres))].slice(0, 10);

  // Responsive: force single-column vertical chain on mobile for clarity
  const w = containerWidth || 600;
  const isXs = w < 480;
  const isSm = w < 720;

  const cols = isXs ? 1 : isSm ? 2 : 3;
  const gapX = isXs ? 12 : 24;
  const gapY = isXs ? 64 : 80;
  const sidePad = isXs ? 8 : gapX;

  const availableWidth = w - sidePad * 2 - gapX * Math.max(0, cols - 1);
  const nodeWidth = isXs
    ? Math.max(200, availableWidth) // full-width on mobile for legibility
    : Math.max(120, Math.min(190, availableWidth / cols));
  const nodeHeight = isXs ? 78 : 68;

  const svgWidth = sidePad * 2 + cols * nodeWidth + (cols - 1) * gapX;
  const rows = Math.ceil(nodes.length / cols);
  const svgHeight = rows * nodeHeight + (rows - 1) * gapY + gapY;

  const fs = {
    title: isXs ? 12 : Math.max(9, Math.min(11, nodeWidth * 0.075)),
    date: isXs ? 10 : Math.max(7, Math.min(9, nodeWidth * 0.06)),
    meta: isXs ? 10 : Math.max(7, Math.min(9, nodeWidth * 0.058)),
    edge: isXs ? 9 : Math.max(7, Math.min(9, nodeWidth * 0.055)),
  };

  const positions = nodes.map((_, i) => {
    const row = Math.floor(i / cols);
    // Vertical chain on mobile (no zigzag) — clearer top-to-bottom flow
    const colIndex = isXs ? 0 : row % 2 === 0 ? i % cols : cols - 1 - (i % cols);
    return {
      x: sidePad + colIndex * (nodeWidth + gapX),
      y: gapY / 2 + row * (nodeHeight + gapY),
    };
  });

  const edges = nodes.slice(1).map((node, i) => {
    const prev = nodes[i];
    const sim = computeSimilarity(prev, node);
    return {
      from: positions[i],
      to: positions[i + 1],
      sim,
      fromNode: prev,
      toNode: node,
    };
  });

  const truncate = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + "…" : s);
  const titleMaxChars = Math.max(10, Math.floor(nodeWidth / (fs.title * 0.55)));

  const selectedEdgeData = selectedEdge !== null ? edges[selectedEdge] : null;

  return (
    <>
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-card border border-border rounded-xl p-3 sm:p-4 space-y-3"
      >
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-display font-semibold uppercase tracking-[0.15em] text-primary">
            Mix Lineage
          </h3>
        </div>

        <p className="text-[10px] sm:text-[11px] text-muted-foreground font-body leading-relaxed">
          Each node is a mix, colored by genre. Thicker links = more related. Tap any node or %.
        </p>

        {/* Genre legend */}
        <div className="flex flex-wrap gap-x-2 gap-y-1">
          {allGenres.map((genre) => (
            <div key={genre} className="flex items-center gap-1">
              <div
                className="w-2 h-2 rounded-full ring-1 ring-border"
                style={{ backgroundColor: getGenreColor(genre) }}
              />
              <span className="text-[9px] sm:text-[10px] text-muted-foreground capitalize">
                {genre}
              </span>
            </div>
          ))}
        </div>

        {/* Tree SVG */}
        <div className="w-full overflow-x-auto -mx-1">
          <svg
            width="100%"
            height={svgHeight}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            preserveAspectRatio="xMidYMid meet"
            className="block"
          >
            {/* Edges */}
            {edges.map((edge, i) => {
              const fromCx = edge.from.x + nodeWidth / 2;
              const fromCy = edge.from.y + nodeHeight;
              const toCx = edge.to.x + nodeWidth / 2;
              const toCy = edge.to.y;
              const midY = (fromCy + toCy) / 2;

              const strokeColor =
                edge.sim.sharedGenres.length > 0
                  ? getGenreColor(edge.sim.sharedGenres[0])
                  : edge.sim.score >= 30
                    ? getGenreColor(edge.toNode.primaryGenre)
                    : "hsl(var(--muted-foreground))";

              const strokeWidth = 1 + (edge.sim.score / 100) * 3; // 1 → 4
              const opacity = 0.25 + (edge.sim.score / 100) * 0.55; // 0.25 → 0.8

              const isActive = selectedEdge === i;

              return (
                <g key={`edge-${i}`} style={{ cursor: "pointer" }}>
                  {/* Wide invisible hit target */}
                  <path
                    d={`M ${fromCx} ${fromCy} C ${fromCx} ${midY}, ${toCx} ${midY}, ${toCx} ${toCy}`}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={18}
                    onClick={() => setSelectedEdge((prev) => (prev === i ? null : i))}
                  />
                  <motion.path
                    d={`M ${fromCx} ${fromCy} C ${fromCx} ${midY}, ${toCx} ${midY}, ${toCx} ${toCy}`}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={isActive ? strokeWidth + 1.5 : strokeWidth}
                    strokeOpacity={isActive ? Math.min(1, opacity + 0.3) : opacity}
                    strokeDasharray={edge.sim.score < 30 ? "4 3" : "none"}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.5, delay: 0.2 + i * 0.08 }}
                    style={{ pointerEvents: "none" }}
                  />
                  {/* Edge label: similarity score */}
                  <g style={{ pointerEvents: "none" }}>
                    <rect
                      x={(fromCx + toCx) / 2 - 22}
                      y={midY - 9}
                      width={44}
                      height={16}
                      rx={8}
                      fill="hsl(var(--card))"
                      stroke={strokeColor}
                      strokeOpacity={opacity}
                      strokeWidth={1}
                    />
                    <text
                      x={(fromCx + toCx) / 2}
                      y={midY + 2}
                      textAnchor="middle"
                      fontSize={fs.edge}
                      fontWeight={600}
                      fill={strokeColor}
                      style={{ fontFamily: "var(--font-display, sans-serif)" }}
                    >
                      {edge.sim.score}%
                    </text>
                  </g>
                </g>
              );
            })}

            {/* Nodes */}
            {nodes.map((node, i) => {
              const pos = positions[i];
              const color = getGenreColor(node.primaryGenre);
              const padX = isXs ? 10 : 8;
              const scoreBar = Math.max(10, (node.overallScore / 100) * (nodeWidth - padX * 2));

              return (
                <motion.g
                  key={node.id}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: i * 0.06 }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setSelected(node)}
                  style={{ cursor: "pointer" }}
                  className="group"
                >
                  <rect
                    x={pos.x}
                    y={pos.y}
                    width={nodeWidth}
                    height={nodeHeight}
                    rx={10}
                    fill="hsl(var(--card))"
                    stroke={color}
                    strokeWidth={1.5}
                    className="transition-all group-hover:stroke-[2.5] group-active:stroke-[2.5]"
                    style={{
                      filter: `drop-shadow(0 0 0 ${color})`,
                    }}
                  />
                  <rect
                    x={pos.x}
                    y={pos.y}
                    width={nodeWidth}
                    height={4}
                    rx={2}
                    fill={color}
                    opacity={0.85}
                  />
                  <text
                    x={pos.x + padX}
                    y={pos.y + 18 + fs.title * 0.2}
                    fontSize={fs.title}
                    fontWeight="600"
                    className="fill-foreground pointer-events-none"
                  >
                    {truncate(node.title, titleMaxChars)}
                  </text>
                  <text
                    x={pos.x + padX}
                    y={pos.y + 18 + fs.title + fs.date + 4}
                    fontSize={fs.date}
                    className="fill-muted-foreground pointer-events-none"
                  >
                    {format(new Date(node.date), "MMM d, yyyy")}
                  </text>
                  <rect
                    x={pos.x + padX}
                    y={pos.y + nodeHeight - 20}
                    width={nodeWidth - padX * 2}
                    height={4}
                    rx={2}
                    fill="hsl(var(--muted))"
                  />
                  <motion.rect
                    x={pos.x + padX}
                    y={pos.y + nodeHeight - 20}
                    height={4}
                    rx={2}
                    fill={color}
                    initial={{ width: 0 }}
                    animate={{ width: scoreBar }}
                    transition={{ duration: 0.6, delay: 0.3 + i * 0.06 }}
                  />
                  <text
                    x={pos.x + padX}
                    y={pos.y + nodeHeight - 6}
                    fontSize={fs.meta}
                    className="fill-muted-foreground pointer-events-none"
                  >
                    ⚡{Math.round(node.energy)}
                  </text>
                  <text
                    x={pos.x + nodeWidth - padX}
                    y={pos.y + nodeHeight - 6}
                    fontSize={fs.meta}
                    textAnchor="end"
                    className="fill-muted-foreground pointer-events-none"
                  >
                    {Math.round(node.overallScore)}
                  </text>
                </motion.g>
              );
            })}
          </svg>
        </div>

        {/* Selected edge breakdown */}
        {selectedEdgeData && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-md border border-border bg-secondary/30 p-2.5 space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Link2
                  className="w-3 h-3"
                  style={{
                    color:
                      selectedEdgeData.sim.sharedGenres.length > 0
                        ? getGenreColor(selectedEdgeData.sim.sharedGenres[0])
                        : "hsl(var(--muted-foreground))",
                  }}
                />
                <span className="text-[10px] font-display uppercase tracking-wider text-foreground/90 font-semibold">
                  {selectedEdgeData.sim.label} link · {selectedEdgeData.sim.score}%
                </span>
              </div>
              <button
                onClick={() => setSelectedEdge(null)}
                className="text-[10px] text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="text-[10px] font-body text-muted-foreground">
              {truncate(selectedEdgeData.fromNode.title, 28)} → {truncate(selectedEdgeData.toNode.title, 28)}
            </p>
            {selectedEdgeData.sim.reasons.length > 0 ? (
              <p className="text-[11px] font-body text-foreground/85">
                {selectedEdgeData.sim.reasons.join(" · ")}
              </p>
            ) : (
              <p className="text-[11px] font-body text-muted-foreground italic">
                A stylistic pivot — little overlap between these mixes.
              </p>
            )}
          </motion.div>
        )}
      </motion.div>

      {/* Node detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md bg-card border-border max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <div
                className="absolute top-0 left-0 right-0 h-1 rounded-t-lg"
                style={{ backgroundColor: getGenreColor(selected.primaryGenre) }}
              />
              <DialogHeader className="pt-2">
                <DialogTitle className="font-display text-base text-foreground flex items-center gap-2">
                  <Music
                    className="w-4 h-4"
                    style={{ color: getGenreColor(selected.primaryGenre) }}
                  />
                  {selected.title}
                </DialogTitle>
                <DialogDescription className="font-body text-xs text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(selected.date), "EEEE, MMMM d, yyyy")}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 pt-2">
                {/* Genres */}
                {selected.genres.length > 0 && (
                  <div>
                    <p className="text-[9px] font-display uppercase tracking-wider text-muted-foreground mb-1.5">
                      Genres
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {selected.genres.map((g) => (
                        <span
                          key={g}
                          className="inline-flex items-center gap-1 text-[10px] font-display uppercase tracking-widest text-foreground/80 capitalize"
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: getGenreColor(g) }}
                            aria-hidden
                          />
                          {g}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Score grid */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-md border border-border bg-secondary/40 p-2">
                    <div className="flex items-center gap-1 text-[9px] font-display uppercase tracking-wider text-muted-foreground">
                      <TrendingUp className="w-3 h-3" /> Overall
                    </div>
                    <div className="text-lg font-display font-semibold text-foreground">
                      {Math.round(selected.overallScore)}
                    </div>
                  </div>
                  <div className="rounded-md border border-border bg-secondary/40 p-2">
                    <div className="flex items-center gap-1 text-[9px] font-display uppercase tracking-wider text-muted-foreground">
                      <Zap className="w-3 h-3" /> Energy
                    </div>
                    <div className="text-lg font-display font-semibold text-foreground">
                      {Math.round(selected.energy)}
                    </div>
                  </div>
                  <div className="rounded-md border border-border bg-secondary/40 p-2">
                    <div className="flex items-center gap-1 text-[9px] font-display uppercase tracking-wider text-muted-foreground">
                      <Sparkles className="w-3 h-3" /> Transitions
                    </div>
                    <div className="text-lg font-display font-semibold text-foreground">
                      {Math.round(selected.transitionScore)}
                    </div>
                  </div>
                </div>

                {/* Extra metrics row: BPM, Key, Mood */}
                {(selected.raw?.bpm || selected.raw?.key || selected.raw?.mood) && (
                  <div className="grid grid-cols-3 gap-2">
                    {selected.raw?.bpm && (
                      <div className="rounded-md border border-border bg-secondary/40 p-2">
                        <div className="flex items-center gap-1 text-[9px] font-display uppercase tracking-wider text-muted-foreground">
                          <Gauge className="w-3 h-3" /> BPM
                        </div>
                        <div className="text-sm font-display font-semibold text-foreground">
                          {selected.raw.bpm}
                        </div>
                      </div>
                    )}
                    {selected.raw?.key && (
                      <div className="rounded-md border border-border bg-secondary/40 p-2">
                        <div className="text-[9px] font-display uppercase tracking-wider text-muted-foreground">
                          Key
                        </div>
                        <div className="text-sm font-display font-semibold text-foreground">
                          {selected.raw.key}
                        </div>
                      </div>
                    )}
                    {selected.raw?.mood && (
                      <div className="rounded-md border border-border bg-secondary/40 p-2 col-span-1">
                        <div className="text-[9px] font-display uppercase tracking-wider text-muted-foreground">
                          Mood
                        </div>
                        <div className="text-[11px] font-body text-foreground/90 leading-tight">
                          {selected.raw.mood}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Energy profile sparkline */}
                {Array.isArray(selected.raw?.energy_profile) &&
                  selected.raw.energy_profile.length > 1 && (
                    <div className="rounded-md border border-border bg-secondary/30 p-2">
                      <div className="flex items-center gap-1 text-[9px] font-display uppercase tracking-wider text-muted-foreground mb-1">
                        <Activity className="w-3 h-3" /> Energy Flow
                      </div>
                      <svg width="100%" height="40" viewBox="0 0 100 40" preserveAspectRatio="none">
                        {(() => {
                          const ep: number[] = selected.raw.energy_profile;
                          const max = Math.max(...ep, 1);
                          const points = ep
                            .map(
                              (v, i) =>
                                `${(i / (ep.length - 1)) * 100},${40 - (v / max) * 36 - 2}`,
                            )
                            .join(" ");
                          return (
                            <polyline
                              points={points}
                              fill="none"
                              stroke={getGenreColor(selected.primaryGenre)}
                              strokeWidth="1.5"
                              strokeLinejoin="round"
                            />
                          );
                        })()}
                      </svg>
                    </div>
                  )}

                {/* Summary */}
                {selected.raw?.summary && (
                  <div className="rounded-md border border-border bg-secondary/30 p-2">
                    <p className="text-[9px] font-display uppercase tracking-wider text-muted-foreground mb-1">
                      Summary
                    </p>
                    <p className="text-[11px] font-body text-foreground/90 leading-relaxed">
                      {selected.raw.summary}
                    </p>
                  </div>
                )}

                {/* Reference points / sounds-like */}
                {Array.isArray(selected.raw?.reference_points) &&
                  selected.raw.reference_points.length > 0 && (
                    <div className="rounded-md border border-border bg-secondary/30 p-2">
                      <p className="text-[9px] font-display uppercase tracking-wider text-muted-foreground mb-1">
                        Sounds Like
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {selected.raw.reference_points
                          .slice(0, 4)
                          .map((r: string, idx: number) => (
                            <span
                              key={idx}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-card border border-border text-foreground/80"
                            >
                              {r}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}

                {/* Standout moments */}
                {Array.isArray(selected.raw?.standout_moments) &&
                  selected.raw.standout_moments.length > 0 && (
                    <div className="rounded-md border border-border bg-secondary/30 p-2">
                      <p className="text-[9px] font-display uppercase tracking-wider text-muted-foreground mb-1">
                        Standout Moments
                      </p>
                      <ul className="space-y-1">
                        {selected.raw.standout_moments
                          .slice(0, 5)
                          .map((m: any, idx: number) => (
                            <li
                              key={idx}
                              className="text-[11px] font-body text-foreground/90 leading-relaxed"
                            >
                              • {typeof m === "string" ? m : m.description || m.title || ""}
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}

                {/* Tracklist preview */}
                {Array.isArray(selected.raw?._mix?.tracklist) &&
                  selected.raw._mix.tracklist.length > 0 && (
                    <div className="rounded-md border border-border bg-secondary/30 p-2">
                      <div className="flex items-center gap-1 text-[9px] font-display uppercase tracking-wider text-muted-foreground mb-1">
                        <ListMusic className="w-3 h-3" /> Tracklist
                      </div>
                      <ul className="space-y-0.5">
                        {selected.raw._mix.tracklist
                          .slice(0, 8)
                          .map((t: any, idx: number) => (
                            <li
                              key={idx}
                              className="text-[11px] font-body text-foreground/85 leading-snug"
                            >
                              <span className="text-muted-foreground tabular-nums mr-1.5">
                                {String(idx + 1).padStart(2, "0")}.
                              </span>
                              {typeof t === "string"
                                ? t
                                : `${t.artist || ""}${t.artist ? " — " : ""}${t.title || t.name || ""}`}
                            </li>
                          ))}
                        {selected.raw._mix.tracklist.length > 8 && (
                          <li className="text-[10px] text-muted-foreground italic pt-0.5">
                            +{selected.raw._mix.tracklist.length - 8} more
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MixLineageTree;
