// Mix Lab V2 — shared presentational primitives.
// StateBadge (live/forming/needs_dsp honesty), ReceiptsList (the evidence behind
// a stat), and StatCard (a stat that can expose its receipts on demand).
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { fmtTime } from "@/types/recognition";
import type { DnaStat, DnaState, TrackRef } from "@/types/mixIntelligence";

const STATE_META: Record<DnaState, { label: string; className: string }> = {
  live: {
    label: "Live",
    className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
  forming: {
    label: "Forming",
    className: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  },
  needs_dsp: {
    label: "Needs DSP",
    className: "bg-muted text-muted-foreground border-border",
  },
};

export function StateBadge({ state }: { state: DnaState }) {
  const m = STATE_META[state];
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 font-display text-[9px] font-semibold uppercase tracking-wider ${m.className}`}
    >
      {m.label}
    </span>
  );
}

export function ReceiptsList({ refs }: { refs: TrackRef[] }) {
  if (!refs.length) return null;
  return (
    <ul className="mt-2 space-y-1 border-l border-border/60 pl-3">
      {refs.map((r, i) => (
        <li
          key={`${r.position}-${i}`}
          className="font-body text-[10px] leading-relaxed text-muted-foreground"
        >
          <span className="text-foreground/70">
            {String(r.position).padStart(2, "0")}
          </span>{" "}
          {r.title ?? "Unknown"}
          {r.artist ? ` · ${r.artist}` : ""}
          {r.startSeconds != null && (
            <span className="opacity-60"> @ {fmtTime(r.startSeconds)}</span>
          )}
          {r.confidence != null && (
            <span className="opacity-60"> · {Math.round(r.confidence)}%</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function StatCard({ stat }: { stat: DnaStat<unknown> }) {
  const [open, setOpen] = useState(false);
  const dimmed = stat.state !== "live";
  return (
    <div
      className={`rounded-xl border p-3 transition-colors ${
        dimmed
          ? "border-border/50 bg-background/30"
          : "border-border/70 bg-gradient-to-b from-background/80 to-background/40"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-[10px] uppercase tracking-widest text-muted-foreground">
            {stat.label}
          </p>
          <p
            className={`mt-0.5 font-display text-sm font-semibold ${
              dimmed ? "text-muted-foreground" : "text-foreground"
            }`}
          >
            {stat.display}
          </p>
        </div>
        <StateBadge state={stat.state} />
      </div>

      {stat.note && (
        <p className="mt-1.5 font-body text-[10px] leading-relaxed text-muted-foreground/80">
          {stat.note}
        </p>
      )}

      {stat.receipts.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-2 inline-flex items-center gap-1 font-display text-[9px] uppercase tracking-wider text-primary/80 transition-colors hover:text-primary"
          >
            <ChevronDown
              className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
            />
            {open ? "Hide" : "Show"} receipts ({stat.receipts.length})
          </button>
          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <ReceiptsList refs={stat.receipts} />
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
