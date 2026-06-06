// Horizontal mix timeline — one block per detected region, sized by duration,
// colored by confidence status. Unknown sections show in the destructive accent.
import { SEGMENT_STATUS_META, fmtTime, type RecognizedTrack } from "@/types/recognition";

export default function RecognitionTimeline({
  tracks,
  durationSeconds,
  selectedId,
  onSelect,
}: {
  tracks: RecognizedTrack[];
  durationSeconds: number;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const total =
    durationSeconds || tracks.reduce((m, t) => Math.max(m, t.endSeconds ?? 0), 0) || 1;

  return (
    <div className="space-y-1.5">
      <div className="flex h-10 w-full overflow-hidden rounded-md border border-border/70 bg-background/60">
        {tracks.map((t) => {
          const start = t.startSeconds ?? 0;
          const end = t.endSeconds ?? start;
          const pct = Math.max(1, ((end - start) / total) * 100);
          const meta = SEGMENT_STATUS_META[t.status];
          const active = selectedId === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect?.(t.id)}
              title={`${t.position}. ${t.artist ? `${t.artist} — ` : ""}${t.title ?? "Unknown"} · ${fmtTime(start)}`}
              style={{ width: `${pct}%` }}
              className={`h-full border-r border-background/80 opacity-80 transition-all last:border-r-0 hover:opacity-100 ${meta.dot} ${active ? "ring-1 ring-inset ring-primary opacity-100" : ""}`}
            />
          );
        })}
      </div>
      <div className="flex justify-between font-body text-[9px] text-muted-foreground">
        <span>0:00</span>
        <span>{fmtTime(total)}</span>
      </div>
    </div>
  );
}
