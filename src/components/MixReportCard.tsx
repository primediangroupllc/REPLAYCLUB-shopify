import { useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, Zap, Music, TrendingUp, ThumbsUp, AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TransitionDetail {
  position_pct: number;
  technique: string;
  quality: "excellent" | "good" | "fair" | "poor";
  note: string;
}

interface MixAnalysis {
  overall_score: number;
  transition_score: number;
  energy_score: number;
  genres: string[];
  energy_profile: number[];
  transition_details?: TransitionDetail[];
  strengths: string[];
  improvements: string[];
  summary: string;
  analyzed_at: string;
}

interface MixReportCardProps {
  mixId: string;
  analysis: MixAnalysis | null;
  hasWaveform: boolean;
  onAnalysisComplete: (analysis: MixAnalysis) => void;
}

const ScoreRing = ({ score, label, size = 64 }: { score: number; label: string; size?: number }) => {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 80 ? "hsl(var(--chart-2))" : score >= 60 ? "hsl(var(--chart-4))" : "hsl(var(--destructive))";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth="4" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, delay: 0.3 }}
        />
      </svg>
      <div className="absolute flex items-center justify-center" style={{ width: size, height: size }}>
        <span className="font-display font-bold text-foreground text-sm">{score}</span>
      </div>
      <span className="text-muted-foreground text-[10px] font-display uppercase tracking-widest">{label}</span>
    </div>
  );
};

const EnergyChart = ({ profile }: { profile: number[] }) => {
  if (!profile || profile.length === 0) return null;

  const width = 300;
  const height = 56;
  const padY = 4;
  const usableH = height - padY * 2;
  const count = profile.length;

  // Build smooth cubic bezier path
  const points = profile.map((v, i) => ({
    x: (i / (count - 1)) * width,
    y: padY + usableH - (v / 100) * usableH,
  }));

  let linePath = `M ${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx1 = prev.x + (curr.x - prev.x) * 0.4;
    const cpx2 = curr.x - (curr.x - prev.x) * 0.4;
    linePath += ` C ${cpx1},${prev.y} ${cpx2},${curr.y} ${curr.x},${curr.y}`;
  }

  const areaPath = `${linePath} L ${width},${height} L 0,${height} Z`;

  return (
    <div className="w-full" style={{ height }}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-full">
        <defs>
          <linearGradient id="energyGradH" x1="0" y1="0" x2="1" y2="0">
            {profile.map((v, i) => {
              const pct = (i / (count - 1)) * 100;
              // Map energy 0-100 → hue: cool blue (210) → warm red/orange (0)
              const hue = 210 - (v / 100) * 210;
              return (
                <stop key={i} offset={`${pct}%`} stopColor={`hsl(${hue}, 85%, 55%)`} stopOpacity="0.75" />
              );
            })}
          </linearGradient>
          <linearGradient id="energyGradFill" x1="0" y1="0" x2="1" y2="0">
            {profile.map((v, i) => {
              const pct = (i / (count - 1)) * 100;
              const hue = 210 - (v / 100) * 210;
              return (
                <stop key={i} offset={`${pct}%`} stopColor={`hsl(${hue}, 80%, 50%)`} stopOpacity="0.2" />
              );
            })}
          </linearGradient>
        </defs>
        {/* Filled area */}
        <motion.path
          d={areaPath}
          fill="url(#energyGradFill)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        />
        {/* Stroke line */}
        <motion.path
          d={linePath}
          fill="none"
          stroke="url(#energyGradH)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
        {/* Dots at each point */}
        {points.map((p, i) => (
          <motion.circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={2.5}
            fill={`hsl(${210 - (profile[i] / 100) * 210}, 85%, 55%)`}
            stroke="hsl(var(--background))"
            strokeWidth="1"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 * i + 0.4, duration: 0.3 }}
          />
        ))}
      </svg>
    </div>
  );
};

const MixReportCard = ({ mixId, analysis, hasWaveform, onAnalysisComplete }: MixReportCardProps) => {
  const [analyzing, setAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    if (!hasWaveform) {
      toast.error("Waveform data needed for analysis — please wait for it to generate first");
      return;
    }

    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-mix", {
        body: { mix_id: mixId },
      });

      if (error) throw error;

      // Handle Blob response
      let resolved = data;
      if (data instanceof Blob) {
        const text = await data.text();
        try { resolved = JSON.parse(text); } catch { resolved = null; }
      }

      if (resolved?.analysis) {
        onAnalysisComplete(resolved.analysis);
        toast.success("Mix analysis complete! 🎧");
      } else if (resolved?.error) {
        toast.error(resolved.error);
      } else {
        toast.error("Analysis returned unexpected format");
      }
    } catch (err: any) {
      console.error("Analysis error:", err);
      toast.error(err.message || "Failed to analyze mix");
    } finally {
      setAnalyzing(false);
    }
  };

  if (!analysis) {
    return (
      <div className="mt-3 p-4 rounded-md bg-secondary/30 border border-border text-center space-y-3">
        <div className="flex items-center gap-2 justify-center">
          <Sparkles className="h-4 w-4 text-chrome" />
          <span className="text-xs font-display uppercase tracking-widest text-muted-foreground">
            AI Mix Analysis
          </span>
        </div>
        <p className="text-muted-foreground text-xs font-body">
          Get AI-powered feedback on your transitions, energy flow, and genre classification
        </p>
        <Button
          onClick={handleAnalyze}
          disabled={analyzing || !hasWaveform}
          size="sm"
          className="chrome-btn font-display text-xs uppercase tracking-widest"
        >
          {analyzing ? (
            <>
              <Loader2 className="h-3 w-3 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <BarChart3 className="h-3 w-3 mr-2" />
              Analyze My Mix
            </>
          )}
        </Button>
        {!hasWaveform && (
          <p className="text-muted-foreground/60 text-[10px] font-body">
            Waiting for waveform data to be generated...
          </p>
        )}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 p-4 rounded-md bg-secondary/30 border border-border space-y-4"
    >
      {/* Header */}
      <div className="flex items-center gap-2 justify-center">
        <Sparkles className="h-4 w-4 text-chrome" />
        <span className="text-xs font-display uppercase tracking-widest text-muted-foreground">
          Mix Report Card
        </span>
      </div>

      {/* Scores */}
      <div className="flex justify-center gap-6">
        <div className="relative">
          <ScoreRing score={analysis.overall_score} label="Overall" size={56} />
        </div>
        <div className="relative">
          <ScoreRing score={analysis.transition_score} label="Transitions" size={56} />
        </div>
        <div className="relative">
          <ScoreRing score={analysis.energy_score} label="Energy" size={56} />
        </div>
      </div>

      {/* Genres */}
      <div className="flex flex-wrap gap-1.5 justify-center">
        {analysis.genres.map((genre) => (
          <span
            key={genre}
            className="px-2 py-0.5 rounded-full bg-chrome/10 border border-chrome/20 text-chrome text-[10px] font-display uppercase tracking-widest"
          >
            <Music className="h-2.5 w-2.5 inline mr-1" />
            {genre}
          </span>
        ))}
      </div>

      {/* Energy Flow */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3 w-3 text-chrome" />
          <span className="text-[10px] font-display uppercase tracking-widest text-muted-foreground">
            Energy Flow
          </span>
        </div>
        <EnergyChart profile={analysis.energy_profile} />
        <div className="flex justify-between text-[9px] text-muted-foreground/50 font-body">
          <span>Start</span>
          <span>End</span>
        </div>
      </div>

      {/* Transition Details */}
      {analysis.transition_details && analysis.transition_details.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Zap className="h-3 w-3 text-chrome" />
            <span className="text-[10px] font-display uppercase tracking-widest text-muted-foreground">
              Transitions ({analysis.transition_details.length})
            </span>
          </div>
          <div className="space-y-1">
            {analysis.transition_details.map((t, i) => {
              const qualityColor = t.quality === "excellent" ? "text-chart-2" : t.quality === "good" ? "text-chart-4" : t.quality === "fair" ? "text-yellow-500" : "text-destructive";
              return (
                <div key={i} className="flex items-start gap-2 text-[10px] font-body">
                  <span className="text-muted-foreground/60 shrink-0 w-8 text-right">{t.position_pct}%</span>
                  <span className={`shrink-0 ${qualityColor} font-medium capitalize`}>{t.quality}</span>
                  <span className="text-foreground/60 truncate" title={t.note}>
                    {t.technique.replace(/_/g, " ")} — {t.note}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary */}
      <p className="text-foreground/80 text-xs font-body text-center leading-relaxed">
        {analysis.summary}
      </p>

      {/* Strengths & Improvements */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-1">
            <ThumbsUp className="h-3 w-3 text-chart-2" />
            <span className="text-[10px] font-display uppercase tracking-widest text-muted-foreground">
              Strengths
            </span>
          </div>
          {analysis.strengths.map((s, i) => (
            <p key={i} className="text-foreground/70 text-[10px] font-body leading-tight">
              • {s}
            </p>
          ))}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-1">
            <Zap className="h-3 w-3 text-chart-4" />
            <span className="text-[10px] font-display uppercase tracking-widest text-muted-foreground">
              Improve
            </span>
          </div>
          {analysis.improvements.map((s, i) => (
            <p key={i} className="text-foreground/70 text-[10px] font-body leading-tight">
              • {s}
            </p>
          ))}
        </div>
      </div>

      {/* Re-analyze */}
      <div className="text-center pt-1">
        <Button
          onClick={handleAnalyze}
          disabled={analyzing}
          variant="ghost"
          size="sm"
          className="text-muted-foreground text-[10px] font-display uppercase tracking-widest"
        >
          {analyzing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <BarChart3 className="h-3 w-3 mr-1" />}
          Re-analyze
        </Button>
      </div>

      {/* AI disclaimer */}
      <p className="text-[9px] font-body text-muted-foreground/60 text-center leading-relaxed pt-1 border-t border-border/30 flex items-center justify-center gap-1">
        <Sparkles className="h-2.5 w-2.5 opacity-60" />
        Generated by AI from waveform data — results are an estimate and may not always be accurate.
      </p>
    </motion.div>
  );
};

export default MixReportCard;
