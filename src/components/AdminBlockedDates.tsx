import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import { logAdminAction } from "@/lib/auditLog";

interface BlockedDate {
  id: string;
  blocked_date: string;
  reason: string | null;
  room_title: string | null;
  created_at: string;
}

interface AdminBlockedDatesProps {
  blockedDates: BlockedDate[];
  onRefresh: () => void;
}

const ROOMS = ["All Rooms", "Disk Jockey", "Podcast", "Studio Sesh", "Photoshoot", "Livestream"];

const AdminBlockedDates = ({ blockedDates, onRefresh }: AdminBlockedDatesProps) => {
  const [newDate, setNewDate] = useState("");
  const [newReason, setNewReason] = useState("");
  const [newRoom, setNewRoom] = useState("All Rooms");
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();

  const handleAdd = async () => {
    if (!newDate) return;
    setAdding(true);
    try {
      const { error } = await supabase.from("blocked_dates").insert({
        blocked_date: newDate,
        reason: newReason || null,
        room_title: newRoom === "All Rooms" ? null : newRoom,
      });
      if (error) throw error;
      toast({ title: "Date blocked", description: `${newDate} is now unavailable.` });
      setNewDate("");
      setNewReason("");
      setNewRoom("All Rooms");
      onRefresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("blocked_dates").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Date unblocked" });
      logAdminAction("delete", "blocked_date", id);
      onRefresh();
    }
  };

  const sortedDates = [...blockedDates].sort(
    (a, b) => new Date(a.blocked_date).getTime() - new Date(b.blocked_date).getTime()
  );

  const futureDates = sortedDates.filter((d) => d.blocked_date >= new Date().toISOString().split("T")[0]);
  const pastDates = sortedDates.filter((d) => d.blocked_date < new Date().toISOString().split("T")[0]);

  return (
    <div className="space-y-6">
      {/* Add new blocked date */}
      <div className="chrome-surface rounded-lg p-4 space-y-4">
        <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
          <Ban className="w-4 h-4" />
          Block a Date
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            min={new Date().toISOString().split("T")[0]}
            className="bg-card border border-border text-foreground rounded-md px-3 py-2 text-xs font-body focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <select
            value={newRoom}
            onChange={(e) => setNewRoom(e.target.value)}
            className="bg-card border border-border text-foreground rounded-md px-3 py-2 text-xs font-body focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {ROOMS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <input
          type="text"
          placeholder="Reason (e.g., Holiday, Maintenance)"
          value={newReason}
          onChange={(e) => setNewReason(e.target.value)}
          className="w-full bg-card border border-border text-foreground rounded-md px-3 py-2 text-xs font-body focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          onClick={handleAdd}
          disabled={!newDate || adding}
          className="w-full bg-primary text-primary-foreground font-display text-sm font-semibold uppercase tracking-wider py-2.5 rounded-md hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {adding ? "Blocking..." : "Block Date"}
        </button>
      </div>

      {/* Upcoming blocked dates */}
      <div className="chrome-surface rounded-lg p-4 space-y-3">
        <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">
          Upcoming Blocked Dates ({futureDates.length})
        </h3>
        <div className="space-y-2">
          {futureDates.map((bd) => (
            <div key={bd.id} className="flex items-center justify-between p-3 bg-card rounded-md border border-border/30">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm font-semibold text-foreground">
                    {new Date(bd.blocked_date + "T12:00:00").toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="text-[9px] font-display uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive">
                    {bd.room_title || "All Rooms"}
                  </span>
                </div>
                {bd.reason && (
                  <p className="text-[11px] text-muted-foreground font-body mt-0.5">{bd.reason}</p>
                )}
              </div>
              <button
                onClick={() => handleDelete(bd.id)}
                className="text-destructive hover:text-destructive/80 transition-colors ml-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {futureDates.length === 0 && (
            <p className="text-center text-muted-foreground text-sm font-body py-6">
              No upcoming blocked dates.
            </p>
          )}
        </div>
      </div>

      {/* Past blocked dates (collapsed) */}
      {pastDates.length > 0 && (
        <details className="chrome-surface rounded-lg overflow-hidden">
          <summary className="p-4 font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors">
            Past Blocked Dates ({pastDates.length})
          </summary>
          <div className="px-4 pb-4 space-y-2">
            {pastDates.map((bd) => (
              <div key={bd.id} className="flex items-center justify-between p-2 bg-card/50 rounded-md opacity-60">
                <div>
                  <span className="font-display text-xs text-foreground">
                    {new Date(bd.blocked_date + "T12:00:00").toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <span className="text-[10px] text-muted-foreground ml-2">{bd.room_title || "All"}</span>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
};

export default AdminBlockedDates;
