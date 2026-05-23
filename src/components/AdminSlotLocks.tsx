import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Lock, RefreshCcw, Trash2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { logAdminAction } from "@/lib/auditLog";

interface SlotLock {
  id: string;
  room_title: string;
  booking_date: string;
  booking_time: string;
  locked_by_email: string;
  expires_at: string;
  created_at: string;
  stripe_session_id: string | null;
}

interface EquipmentLock {
  id: string;
  equipment_name: string;
  pickup_date: string;
  rental_days: number;
  locked_by_email: string;
  expires_at: string;
}

const formatExpiresIn = (iso: string) => {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s.toString().padStart(2, "0")}s`;
};

const AdminSlotLocks = () => {
  const [slotLocks, setSlotLocks] = useState<SlotLock[]>([]);
  const [equipmentLocks, setEquipmentLocks] = useState<EquipmentLock[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const fetchAll = async () => {
    setLoading(true);
    const nowIso = new Date().toISOString();
    const [slots, gear] = await Promise.all([
      supabase
        .from("slot_locks")
        .select("*")
        .gt("expires_at", nowIso)
        .order("expires_at", { ascending: true }),
      supabase
        .from("equipment_locks" as any)
        .select("*")
        .gt("expires_at", nowIso)
        .order("expires_at", { ascending: true }),
    ]);
    setSlotLocks(((slots.data as unknown) as SlotLock[]) || []);
    setEquipmentLocks(((gear.data as unknown) as EquipmentLock[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    const refresh = setInterval(fetchAll, 30_000);
    const ticker = setInterval(() => setTick((t) => t + 1), 1_000);
    return () => {
      clearInterval(refresh);
      clearInterval(ticker);
    };
  }, []);

  const releaseSlot = async (id: string) => {
    const target = slotLocks.find((l) => l.id === id);
    const { error } = await supabase.rpc("release_slot_lock", { p_lock_id: id });
    if (error) {
      toast.error("Failed to release lock");
      return;
    }
    await logAdminAction("delete", "slot_lock", id, {
      reason: "admin_force_release",
      room_title: target?.room_title,
      booking_date: target?.booking_date,
      booking_time: target?.booking_time,
      locked_by_email: target?.locked_by_email,
    });
    toast.success("Lock released");
    fetchAll();
  };

  const releaseEquipment = async (id: string) => {
    const target = equipmentLocks.find((l) => l.id === id);
    const { error } = await supabase.rpc("release_equipment_locks" as any, { p_lock_ids: [id] });
    if (error) {
      toast.error("Failed to release lock");
      return;
    }
    await logAdminAction("delete", "equipment_lock", id, {
      reason: "admin_force_release",
      equipment_name: target?.equipment_name,
      pickup_date: target?.pickup_date,
      rental_days: target?.rental_days,
      locked_by_email: target?.locked_by_email,
    });
    toast.success("Lock released");
    fetchAll();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-primary" />
          <h2 className="font-display text-base font-bold text-foreground uppercase tracking-wider">
            Active Slot Holds
          </h2>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border/40 text-xs text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />}
          Refresh
        </button>
      </div>

      {/* Room slot holds */}
      <section className="space-y-3">
        <h3 className="font-display text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Room slots ({slotLocks.length})
        </h3>
        {slotLocks.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No active room reservations.</p>
        ) : (
          <div className="space-y-2" data-tick={tick}>
            {slotLocks.map((lock) => (
              <div
                key={lock.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/30 bg-card/50"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-display text-sm font-semibold text-foreground truncate">
                    {lock.room_title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(lock.booking_date), "MMM d, yyyy")} · {lock.booking_time}
                  </p>
                  <p className="text-xs text-muted-foreground/80 truncate">{lock.locked_by_email}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-display text-xs font-bold chrome-text">
                    {formatExpiresIn(lock.expires_at)}
                  </p>
                  <button
                    onClick={() => releaseSlot(lock.id)}
                    className="mt-1 flex items-center gap-1 text-[10px] text-destructive hover:underline"
                  >
                    <Trash2 className="w-2.5 h-2.5" /> Release
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Equipment holds */}
      <section className="space-y-3">
        <h3 className="font-display text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Equipment ({equipmentLocks.length})
        </h3>
        {equipmentLocks.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No active equipment holds.</p>
        ) : (
          <div className="space-y-2">
            {equipmentLocks.map((lock) => (
              <div
                key={lock.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/30 bg-card/50"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-display text-sm font-semibold text-foreground truncate">
                    {lock.equipment_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(lock.pickup_date), "MMM d, yyyy")} · {lock.rental_days} day(s)
                  </p>
                  <p className="text-xs text-muted-foreground/80 truncate">{lock.locked_by_email}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-display text-xs font-bold chrome-text">
                    {formatExpiresIn(lock.expires_at)}
                  </p>
                  <button
                    onClick={() => releaseEquipment(lock.id)}
                    className="mt-1 flex items-center gap-1 text-[10px] text-destructive hover:underline"
                  >
                    <Trash2 className="w-2.5 h-2.5" /> Release
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminSlotLocks;