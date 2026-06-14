// Mix Lab V2 — Progression (placeholder). Collection-style milestones from real
// recognition counts. Descriptive, no points/streaks/grind (Withholding Doctrine).
import { useState } from "react";
import { Check, Circle } from "lucide-react";
import type { Milestone } from "@/types/mixIntelligence";
import { ReceiptsList } from "./shared";

export default function ProgressionPanel({ milestones }: { milestones: Milestone[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const done = milestones.filter((m) => m.achieved).length;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-display text-xs font-semibold uppercase tracking-widest text-foreground">
          Progression
        </p>
        <p className="font-body text-[10px] text-muted-foreground">
          {done} of {milestones.length} reached
        </p>
      </div>
      <p className="font-body text-[10px] text-muted-foreground/80">
        Milestones from real recognition — a collection that fills as you play. No points,
        no streaks.
      </p>
      <ol className="space-y-2">
        {milestones.map((m) => (
          <li
            key={m.id}
            className={`rounded-xl border p-3 ${
              m.achieved
                ? "border-border/70 bg-gradient-to-b from-background/80 to-background/40"
                : "border-border/40 bg-background/20"
            }`}
          >
            <button
              type="button"
              onClick={() => setOpenId((v) => (v === m.id ? null : m.id))}
              className="flex w-full items-start gap-3 text-left"
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  m.achieved
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                    : "border-border text-muted-foreground/50"
                }`}
              >
                {m.achieved ? <Check className="h-3 w-3" /> : <Circle className="h-2 w-2" />}
              </span>
              <div className="min-w-0">
                <p
                  className={`font-display text-sm font-semibold ${
                    m.achieved ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {m.label}
                </p>
                <p className="font-body text-[11px] text-muted-foreground">{m.detail}</p>
              </div>
            </button>
            {openId === m.id && m.evidence.length > 0 && (
              <ReceiptsList refs={m.evidence} />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
