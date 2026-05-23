import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink, Pencil, Copy, Check, Link2 } from "lucide-react";
import { toast } from "sonner";

interface MasterLink {
  name: string;
  liveUrl: string | null;
  adminUrl: string;
}

const LINKS: MasterLink[] = [
  { name: "Main Homepage", liveUrl: "/", adminUrl: "/admin/homepage" },
  { name: "DJ Booking", liveUrl: "/dj", adminUrl: "/admin/dj" },
  { name: "Podcast Booking", liveUrl: "/podcast", adminUrl: "/admin/podcast" },
  { name: "Recording Booking", liveUrl: "/recording", adminUrl: "/admin/recording" },
  { name: "Backdrop Booking", liveUrl: "/backdrop", adminUrl: "/admin/backdrop" },
  { name: "Events Homepage", liveUrl: "/events", adminUrl: "/admin/events/homepage" },
  { name: "All Events List", liveUrl: "/events", adminUrl: "/admin/events" },
  { name: "Site FAQ Settings", liveUrl: null, adminUrl: "/admin/faq" },
  { name: "Site Footer / Contact", liveUrl: null, adminUrl: "/admin/footer" },
  { name: "Stripe Settings", liveUrl: null, adminUrl: "/admin/stripe" },
];

const CopyButton = ({ value }: { value: string }) => {
  const [copied, setCopied] = useState(false);
  const onCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${value}`);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };
  return (
    <button
      onClick={onCopy}
      aria-label="Copy link"
      className="shrink-0 p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
    </button>
  );
};

const AdminMasterLinks = () => {
  const navigate = useNavigate();
  // Default collapsed so the admin panel opens clean; admins can expand on demand.
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className="card-premium card-premium-accent p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-primary" />
          <h3 className="font-display text-sm font-bold text-foreground uppercase tracking-wider">
            Master Links
          </h3>
        </div>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="text-[10px] uppercase tracking-wider font-display text-muted-foreground hover:text-foreground"
        >
          {collapsed ? "Show" : "Hide"}
        </button>
      </div>
      {!collapsed && (
        <div className="space-y-1.5">
          {LINKS.map((link) => (
            <div
              key={link.adminUrl + link.name}
              className="flex flex-col sm:flex-row sm:items-center gap-2 bg-card border border-border/30 rounded px-2.5 py-2"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-xs font-display font-bold text-foreground uppercase tracking-wider truncate">
                  {link.name}
                </p>
                <div className="flex flex-col gap-0.5 text-[10px] font-mono text-muted-foreground">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="shrink-0 text-[9px] uppercase text-muted-foreground/60">Live</span>
                    <span className="truncate">{link.liveUrl ?? "n/a"}</span>
                    {link.liveUrl && <CopyButton value={link.liveUrl} />}
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="shrink-0 text-[9px] uppercase text-muted-foreground/60">Admin</span>
                    <span className="truncate">{link.adminUrl}</span>
                    <CopyButton value={link.adminUrl} />
                  </div>
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => link.liveUrl && window.open(link.liveUrl, "_blank", "noopener,noreferrer")}
                  disabled={!link.liveUrl}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-card border border-border/30 text-[10px] font-display uppercase tracking-wider text-foreground hover:bg-muted/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ExternalLink className="w-3 h-3" />
                  View Live
                </button>
                <button
                  onClick={() => navigate(link.adminUrl)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-primary text-primary-foreground text-[10px] font-display uppercase tracking-wider font-semibold hover:opacity-90 transition-opacity"
                >
                  <Pencil className="w-3 h-3" />
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminMasterLinks;
