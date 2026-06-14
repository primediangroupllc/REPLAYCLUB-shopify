// Mix Lab V2 — DJ DNA panel. Recognition-sourced identity, no Gemini/scores.
// Radar = real axes (coverage/diversity/linked/confidence + a labelled depth
// proxy); stat cards expose receipts and honestly mark forming / needs-DSP signals.
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { Dna } from "lucide-react";
import type { DjDnaV2 } from "@/types/mixIntelligence";
import { StatCard } from "./shared";

export default function DjDnaPanel({ dna }: { dna: DjDnaV2 }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, hsl(15,90%,58%), hsl(50,90%,55%), hsl(160,70%,50%), hsl(195,85%,55%), hsl(285,75%,62%), hsl(15,90%,58%))",
          }}
        >
          <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-background">
            <Dna className="h-4 w-4 text-foreground" />
          </div>
        </div>
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-widest text-foreground">
            DJ DNA
          </p>
          <p className="font-body text-[10px] text-muted-foreground">
            {dna.identified} of {dna.totalTracks} tracks identified · from real recognition
          </p>
        </div>
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={dna.radar} cx="50%" cy="50%" outerRadius="72%">
            <PolarGrid stroke="hsl(var(--border))" strokeOpacity={0.55} />
            <PolarAngleAxis
              dataKey="axis"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }}
            />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              dataKey="value"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.25}
              strokeWidth={2}
              isAnimationActive
              animationDuration={800}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <p className="-mt-2 text-center font-body text-[9px] text-muted-foreground/70">
        Depth is an early proxy (off-Spotify share) until popularity enrichment lands.
      </p>

      <div className="grid gap-2">
        {dna.stats.map((s) => (
          <StatCard key={s.key} stat={s} />
        ))}
      </div>
    </div>
  );
}
