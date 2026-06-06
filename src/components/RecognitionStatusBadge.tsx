// Status pill for a recognition JOB (Profile mix card + admin row). Mirrors
// MixStatusBadge styling so the two read as one system.
import { JOB_STATUS_META, type RecognitionJobStatus } from "@/types/recognition";

export default function RecognitionStatusBadge({
  status,
  className = "",
}: {
  status?: RecognitionJobStatus | string | null;
  className?: string;
}) {
  if (!status) return null;
  const meta =
    JOB_STATUS_META[status as RecognitionJobStatus] ?? {
      label: String(status),
      className: "bg-muted text-muted-foreground border border-border",
    };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-display font-semibold uppercase tracking-wider ${meta.className} ${className}`}
    >
      {meta.label}
    </span>
  );
}
