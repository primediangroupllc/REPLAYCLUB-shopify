// Profile-side Mix Lab orchestrator (Commit 1 — structural move).
// READ-ONLY identity surface. Picks among the user's recognized mixes (single-mix
// model) and renders MixLabContent inline/full-width. Deep-linkable via ?mix=<id>.
// Authoring/edit/Confirm stays in AdminDashboard (TrackRecognitionPanel) — not here.
// `recognized`/`loading` come from Profile's single useRecognizedMixes call (shared
// with the Mixes-tab "Open in Mix Lab" action) — this component does NOT re-fetch.
import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { FlaskConical } from "lucide-react";
import MixLabContent from "./MixLabContent";
import { type ProfileMix } from "@/hooks/useRecognizedMixes";

export default function MixLabSection({
  recognized,
  loading,
}: {
  recognized: ProfileMix[];
  loading: boolean;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const mixParam = searchParams.get("mix");

  // ?mix= if it points at a recognized mix, else the most recent recognized one.
  const selected = useMemo(() => {
    if (!recognized.length) return null;
    return recognized.find((m) => m.id === mixParam) ?? recognized[0];
  }, [recognized, mixParam]);

  // Keep ?mix= in sync with the resolved selection so deep-links are shareable.
  useEffect(() => {
    if (selected && mixParam !== selected.id) {
      const next = new URLSearchParams(searchParams);
      next.set("mix", selected.id);
      setSearchParams(next, { replace: true });
    }
  }, [selected, mixParam, searchParams, setSearchParams]);

  if (loading) {
    return (
      <div className="py-10 text-center font-body text-xs text-muted-foreground">
        Loading your mixes…
      </div>
    );
  }

  if (!recognized.length) {
    return (
      <div className="rounded-xl border border-border/60 bg-gradient-to-b from-background/80 to-background/40 p-8 text-center">
        <FlaskConical className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
        <p className="font-display text-xs uppercase tracking-widest text-foreground">
          Mix Lab
        </p>
        <p className="mx-auto mt-1 max-w-[260px] font-body text-[11px] text-muted-foreground">
          No recognized mixes yet — your identity builds from your recognized sets.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {recognized.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {recognized.map((m) => {
            const isActive = m.id === selected?.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  next.set("mix", m.id);
                  setSearchParams(next, { replace: false });
                }}
                className={`shrink-0 rounded-full border px-3 py-1 font-display text-[10px] uppercase tracking-wider transition-colors ${
                  isActive
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-border/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                {m.title ?? "Mix"}
              </button>
            );
          })}
        </div>
      )}
      {selected && (
        <MixLabContent
          mix={{ id: selected.id, title: selected.title ?? "Mix" }}
          active
          variant="inline"
        />
      )}
    </div>
  );
}
