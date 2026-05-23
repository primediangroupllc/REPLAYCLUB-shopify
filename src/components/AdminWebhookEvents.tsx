import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Webhook, RefreshCcw, Loader2, RotateCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { logAdminAction } from "@/lib/auditLog";

interface WebhookEvent {
  id: string;
  event_id: string;
  event_type: string;
  source: string;
  status: string;
  attempts: number;
  error_message: string | null;
  created_at: string;
  processed_at: string | null;
}

const STATUS_FILTERS = ["all", "processed", "failed", "received"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const AdminWebhookEvents = () => {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [replaying, setReplaying] = useState<string | null>(null);

  const fetchEvents = async () => {
    setLoading(true);
    let q = (supabase as any)
      .from("webhook_events")
      .select("id,event_id,event_type,source,status,attempts,error_message,created_at,processed_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (filter !== "all") q = q.eq("status", filter);
    const { data, error } = await q;
    if (error) toast.error("Failed to load webhook events");
    setEvents(((data as unknown) as WebhookEvent[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchEvents();
  }, [filter]);

  const replay = async (id: string, eventId: string) => {
    setReplaying(id);
    try {
      const { error } = await supabase.functions.invoke("replay-webhook-event", {
        body: { id },
      });
      if (error) throw error;
      await logAdminAction("update", "webhook_event", id, { reason: "manual_replay", event_id: eventId });
      toast.success("Webhook replayed");
      fetchEvents();
    } catch (e: any) {
      toast.error(e?.message || "Replay failed");
    } finally {
      setReplaying(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Webhook className="w-4 h-4 text-primary" />
          <h2 className="font-display text-base font-bold text-foreground uppercase tracking-wider">
            Webhook Events
          </h2>
        </div>
        <button
          onClick={fetchEvents}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border/40 text-xs text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />}
          Refresh
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-[10px] font-display uppercase tracking-wider border transition-colors ${
              filter === f
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No webhook events.</p>
      ) : (
        <div className="space-y-2">
          {events.map((e) => {
            const isFailed = e.status === "failed";
            const isProcessed = e.status === "processed";
            return (
              <div
                key={e.id}
                className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border/30 bg-card/50"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isProcessed && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                    {isFailed && <AlertCircle className="w-3 h-3 text-destructive" />}
                    <span className="font-display text-xs font-semibold text-foreground truncate">
                      {e.event_type}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      {e.source}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/80 truncate font-mono mt-0.5">{e.event_id}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {format(new Date(e.created_at), "MMM d, HH:mm:ss")} · {e.attempts} attempt{e.attempts !== 1 ? "s" : ""}
                  </p>
                  {isFailed && e.error_message && (
                    <p className="text-[10px] text-destructive mt-1 line-clamp-2">{e.error_message}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-display uppercase tracking-wider ${
                      isProcessed
                        ? "bg-emerald-500/10 text-emerald-300"
                        : isFailed
                          ? "bg-destructive/10 text-destructive"
                          : "bg-muted/30 text-muted-foreground"
                    }`}
                  >
                    {e.status}
                  </span>
                  {(isFailed || e.status === "received") && (
                    <button
                      onClick={() => replay(e.id, e.event_id)}
                      disabled={replaying === e.id}
                      className="flex items-center gap-1 text-[10px] text-primary hover:underline disabled:opacity-50"
                    >
                      {replaying === e.id ? (
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      ) : (
                        <RotateCw className="w-2.5 h-2.5" />
                      )}
                      Replay
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminWebhookEvents;