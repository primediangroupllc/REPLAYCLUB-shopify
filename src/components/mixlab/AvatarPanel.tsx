// Mix Lab V2 — Avatar (placeholder). No 3D yet. Descriptive traits read from real
// recognition, never a grade; each trait can expose the tracks that earned it.
import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import type { Trait } from "@/types/mixIntelligence";
import { ReceiptsList } from "./shared";

export default function AvatarPanel({ traits }: { traits: Trait[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-3 py-2">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex h-28 w-28 items-center justify-center rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, hsla(15,90%,58%,0.5), hsla(195,85%,55%,0.5), hsla(285,75%,62%,0.5), hsla(15,90%,58%,0.5))",
          }}
        >
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-background">
            <Sparkles className="h-7 w-7 text-muted-foreground" />
          </div>
        </motion.div>
        <p className="font-display text-xs font-semibold uppercase tracking-widest text-foreground">
          Avatar — forming
        </p>
        <p className="max-w-[80%] text-center font-body text-[10px] leading-relaxed text-muted-foreground">
          Your avatar will grow from how you actually play. These traits are read from
          your recognized selections — descriptive, never a grade.
        </p>
      </div>
      <div className="grid gap-2">
        {traits.map((tr) => (
          <div
            key={tr.id}
            className="rounded-xl border border-border/70 bg-gradient-to-b from-background/80 to-background/40 p-3"
          >
            <button
              type="button"
              onClick={() => setOpenId((v) => (v === tr.id ? null : tr.id))}
              className="flex w-full items-center justify-between gap-2 text-left"
            >
              <div className="min-w-0">
                <p className="font-display text-sm font-semibold text-foreground">
                  {tr.label}
                </p>
                <p className="font-body text-[11px] text-muted-foreground">
                  {tr.description}
                </p>
              </div>
              {tr.evidence.length > 0 && (
                <span className="shrink-0 font-display text-[9px] uppercase tracking-wider text-primary/70">
                  {tr.evidence.length} receipts
                </span>
              )}
            </button>
            {openId === tr.id && <ReceiptsList refs={tr.evidence} />}
          </div>
        ))}
      </div>
    </div>
  );
}
