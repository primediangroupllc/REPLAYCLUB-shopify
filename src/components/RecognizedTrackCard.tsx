// A single detected track — chrome card with confidence-coded status. Never
// pretends recognition is perfect: confidence + status are always visible, and
// unknown sections get intentional copy instead of a blank row.
import { Pencil, HelpCircle } from "lucide-react";
import {
  SEGMENT_STATUS_META,
  trackTimeRange,
  UNKNOWN_SECTION_COPY,
  type RecognizedTrack,
} from "@/types/recognition";

export default function RecognizedTrackCard({
  track,
  onEdit,
  onMarkUnknown,
}: {
  track: RecognizedTrack;
  onEdit?: (t: RecognizedTrack) => void;
  onMarkUnknown?: (t: RecognizedTrack) => void;
}) {
  const meta = SEGMENT_STATUS_META[track.status];
  const isUnknown = track.status === "unknown";

  return (
    <div className="group relative rounded-xl border border-border/70 bg-gradient-to-b from-background/80 to-background/40 p-3 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/20">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background/60 font-display text-sm font-bold text-muted-foreground">
          {String(track.position).padStart(2, "0")}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-display text-[9px] font-semibold uppercase tracking-wider ${meta.className}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
              {meta.label}
            </span>
            {track.confidence != null && (
              <span className="font-body text-[10px] text-muted-foreground">
                {Math.round(track.confidence)}%
              </span>
            )}
          </div>

          <h4 className="mt-1 truncate font-display text-sm font-semibold text-foreground">
            {isUnknown ? "Unknown ID" : track.title || "Untitled"}
          </h4>
          <p className="truncate font-body text-xs text-muted-foreground">
            {isUnknown ? UNKNOWN_SECTION_COPY : track.artist || "Unknown artist"}
          </p>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-body text-[10px] text-muted-foreground">
            <span>{trackTimeRange(track)}</span>
            {track.source && track.source !== "unknown" && (
              <span className="uppercase tracking-wide">{track.source}</span>
            )}
            {track.musicalKey && <span>{track.musicalKey}</span>}
            {track.bpm != null && <span>{track.bpm} BPM</span>}
            {track.energyLevel != null && <span>E {track.energyLevel}</span>}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-1">
          <button
            type="button"
            onClick={() => onEdit?.(track)}
            title="Edit track"
            className="rounded-md border border-border/60 p-1.5 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {!isUnknown && (
            <button
              type="button"
              onClick={() => onMarkUnknown?.(track)}
              title="Mark as Unknown ID"
              className="rounded-md border border-border/60 p-1.5 text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
