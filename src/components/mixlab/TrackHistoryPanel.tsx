// Mix Lab V2 — Track History. The recognized "crate" for this mix: every track
// with confidence, time range, and platform deep-links (from metadata.platform_ids).
// Genre/label tags are intentionally absent until enrichment — never faked.
import { ExternalLink } from "lucide-react";
import { SEGMENT_STATUS_META, fmtTime } from "@/types/recognition";
import type { IntelTrack } from "@/types/mixIntelligence";

function platformLinks(t: IntelTrack) {
  const out: { label: string; href: string }[] = [];
  if (t.platforms.spotify)
    out.push({
      label: "Spotify",
      href: `https://open.spotify.com/track/${t.platforms.spotify}`,
    });
  if (t.platforms.deezer)
    out.push({
      label: "Deezer",
      href: `https://www.deezer.com/track/${t.platforms.deezer}`,
    });
  if (t.platforms.youtube)
    out.push({
      label: "YouTube",
      href: `https://www.youtube.com/watch?v=${t.platforms.youtube}`,
    });
  return out;
}

export default function TrackHistoryPanel({ intel }: { intel: IntelTrack[] }) {
  if (!intel.length) {
    return (
      <p className="py-6 text-center font-body text-xs text-muted-foreground">
        No recognized tracks yet.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-display text-xs font-semibold uppercase tracking-widest text-foreground">
          Track History
        </p>
        <p className="font-body text-[10px] text-muted-foreground">
          {intel.length} recognized · this set
        </p>
      </div>
      <p className="font-body text-[10px] text-muted-foreground/80">
        Your crate, built from real recognition. Genre &amp; label tags arrive with enrichment.
      </p>
      <div className="space-y-2">
        {intel.map((t) => {
          const meta = SEGMENT_STATUS_META[t.status];
          const links = platformLinks(t);
          const isUnknown = t.status === "unknown";
          return (
            <div
              key={t.id}
              className="rounded-xl border border-border/70 bg-gradient-to-b from-background/80 to-background/40 p-3"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background/60 font-display text-xs font-bold text-muted-foreground">
                  {String(t.position).padStart(2, "0")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-display text-[9px] font-semibold uppercase tracking-wider ${meta.className}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </span>
                    {t.confidence != null && (
                      <span className="font-body text-[10px] text-muted-foreground">
                        {Math.round(t.confidence)}%
                      </span>
                    )}
                  </div>
                  <h4 className="mt-1 truncate font-display text-sm font-semibold text-foreground">
                    {isUnknown ? "Unknown ID" : t.title || "Untitled"}
                  </h4>
                  <p className="truncate font-body text-xs text-muted-foreground">
                    {isUnknown
                      ? "Unnamed section — edit in the Recognize panel"
                      : t.artist || "Unknown artist"}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-body text-[10px] text-muted-foreground">
                    <span>
                      {fmtTime(t.startSeconds)}–{fmtTime(t.endSeconds)}
                    </span>
                    {t.album && <span className="max-w-[40%] truncate">{t.album}</span>}
                    {links.map((l) => (
                      <a
                        key={l.label}
                        href={l.href}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-0.5 text-primary/80 transition-colors hover:text-primary"
                      >
                        {l.label}
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
