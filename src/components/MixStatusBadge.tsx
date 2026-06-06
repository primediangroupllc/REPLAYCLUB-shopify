// Shared status pill for a mix / report card. Used on the user profile (Mixes
// tab) and the admin dashboard so the status -> label/colour mapping lives in
// one place. Mirrors the existing hand-rolled badge styling (tailwind +
// font-display) rather than pulling in a new primitive.

export const MIX_STATUSES = [
  "uploaded",
  "pending_review",
  "processing",
  "needs_tracklist_review",
  "report_ready",
  "approved",
  "rejected",
  "failed",
] as const;

export type MixStatus = (typeof MIX_STATUSES)[number];

const STATUS_META: Record<MixStatus, { label: string; className: string }> = {
  uploaded: { label: "Uploaded", className: "bg-muted text-muted-foreground border border-border" },
  pending_review: { label: "Pending review", className: "bg-amber-500/15 text-amber-500 border border-amber-500/30" },
  processing: { label: "Processing", className: "bg-blue-500/15 text-blue-400 border border-blue-500/30" },
  needs_tracklist_review: { label: "Needs tracklist", className: "bg-purple-500/15 text-purple-400 border border-purple-500/30" },
  report_ready: { label: "Report ready", className: "bg-teal-500/15 text-teal-400 border border-teal-500/30" },
  approved: { label: "Approved", className: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" },
  rejected: { label: "Rejected", className: "bg-destructive/15 text-destructive border border-destructive/30" },
  failed: { label: "Failed", className: "bg-destructive/15 text-destructive border border-destructive/30" },
};

export default function MixStatusBadge({
  status,
  className = "",
}: {
  status?: string | null;
  className?: string;
}) {
  if (!status) return null;
  const meta =
    STATUS_META[status as MixStatus] ?? {
      label: status,
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
