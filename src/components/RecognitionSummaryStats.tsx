// Header stats for the Track Recognition Room.
import { summarize, type RecognizedTrack, type RecognitionJobStatus } from "@/types/recognition";
import RecognitionStatusBadge from "./RecognitionStatusBadge";

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex min-w-[64px] flex-col items-center rounded-lg border border-border/60 bg-background/40 px-3 py-2">
      <span className={`font-display text-lg font-bold leading-none ${tone}`}>{value}</span>
      <span className="mt-1 font-display text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
  );
}

export default function RecognitionSummaryStats({
  tracks,
  status,
}: {
  tracks: RecognizedTrack[];
  status: RecognitionJobStatus;
}) {
  const s = summarize(tracks);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Stat label="Detected" value={s.total} tone="text-foreground" />
      <Stat label="Confirmed" value={s.confirmed} tone="text-emerald-400" />
      <Stat label="Likely" value={s.likely} tone="text-teal-400" />
      <Stat label="Possible" value={s.possible} tone="text-amber-500" />
      <Stat label="Unknown" value={s.unknown} tone="text-destructive" />
      <div className="ml-auto">
        <RecognitionStatusBadge status={status} />
      </div>
    </div>
  );
}
