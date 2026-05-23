import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, CheckCircle2, Circle, Clock, MapPin, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Booking {
  id: string;
  room_title: string;
  booking_date: string;
  booking_time: string;
  customer_name: string;
  customer_email: string;
  payment_status: string;
  checked_in_at: string | null;
}

interface Props {
  bookings: Booking[];
  onReload: () => void;
  onSelectBooking: (id: string) => void;
}

/** "1:00 PM" → minutes since midnight */
function slotToMinutes(slot: string): number {
  const m = slot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return -1;
  let h = parseInt(m[1], 10) % 12;
  if (m[3].toUpperCase() === "PM") h += 12;
  return h * 60 + parseInt(m[2], 10);
}

function minutesToLabel(min: number): string {
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}

function todayLocalIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const mo = (d.getMonth() + 1).toString().padStart(2, "0");
  const da = d.getDate().toString().padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

interface Session {
  id: string; // first booking id (used to open detail)
  customer_name: string;
  room_title: string;
  startMin: number;
  endMin: number;
  checked_in: boolean;
  payment_status: string;
}

const TodaysBookingsWidget = ({ bookings, onReload, onSelectBooking }: Props) => {
  const [todayIso, setTodayIso] = useState(todayLocalIso());
  const [nowMin, setNowMin] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });

  // Roll over at midnight + tick every minute to dim past sessions.
  useEffect(() => {
    const tick = () => {
      const iso = todayLocalIso();
      const n = new Date();
      setTodayIso((prev) => (prev === iso ? prev : iso));
      setNowMin(n.getHours() * 60 + n.getMinutes());
    };
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Realtime: refresh on any booking change for today.
  useEffect(() => {
    const channel = supabase
      .channel("admin-todays-bookings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => onReload(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [onReload]);

  const sessions = useMemo<Session[]>(() => {
    const todays = bookings.filter(
      (b) =>
        b.booking_date === todayIso &&
        (b.payment_status === "paid" || b.payment_status === "promo"),
    );
    // Group consecutive hourly rows for the same customer + room into a single session.
    const groups = new Map<string, Booking[]>();
    for (const b of todays) {
      const key = `${b.customer_email.toLowerCase()}|${b.room_title}`;
      const arr = groups.get(key) ?? [];
      arr.push(b);
      groups.set(key, arr);
    }
    const result: Session[] = [];
    for (const arr of groups.values()) {
      const sorted = [...arr].sort(
        (a, b) => slotToMinutes(a.booking_time) - slotToMinutes(b.booking_time),
      );
      let run: Booking[] = [];
      const flush = () => {
        if (run.length === 0) return;
        const startMin = slotToMinutes(run[0].booking_time);
        const endMin = slotToMinutes(run[run.length - 1].booking_time) + 60;
        result.push({
          id: run[0].id,
          customer_name: run[0].customer_name,
          room_title: run[0].room_title,
          startMin,
          endMin,
          checked_in: run.some((r) => !!r.checked_in_at),
          payment_status: run[0].payment_status,
        });
        run = [];
      };
      for (const b of sorted) {
        const m = slotToMinutes(b.booking_time);
        if (m < 0) continue;
        if (run.length === 0) {
          run.push(b);
        } else {
          const prevEnd = slotToMinutes(run[run.length - 1].booking_time) + 60;
          if (m === prevEnd) {
            run.push(b);
          } else {
            flush();
            run.push(b);
          }
        }
      }
      flush();
    }
    return result.sort((a, b) => a.startMin - b.startMin);
  }, [bookings, todayIso]);

  const todayLabel = new Date(todayIso + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-premium card-premium-accent p-4 space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <h3 className="font-display text-sm font-bold text-foreground uppercase tracking-wider">
            Today's Bookings
          </h3>
        </div>
        <span className="text-[10px] font-display uppercase tracking-wider text-muted-foreground">
          {todayLabel} · {sessions.length}
        </span>
      </div>

      {sessions.length === 0 ? (
        <p className="text-[11px] text-muted-foreground font-body py-2">
          No bookings today.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {sessions.map((s) => {
            const past = s.endMin <= nowMin;
            const live = s.startMin <= nowMin && nowMin < s.endMin;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onSelectBooking(s.id)}
                  className={`w-full text-left flex items-center gap-3 bg-card border border-border/30 rounded px-2.5 py-2 hover:border-primary/40 hover:bg-muted/30 transition-colors ${
                    past && !s.checked_in ? "opacity-50" : ""
                  }`}
                >
                  <div className="shrink-0 flex items-center gap-1.5 w-[120px]">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[11px] font-mono text-foreground">
                      {minutesToLabel(s.startMin)}–{minutesToLabel(s.endMin)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <User className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="text-[11px] font-body text-foreground font-semibold truncate">
                        {s.customer_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="text-[10px] font-body text-muted-foreground truncate">
                        {s.room_title}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {s.checked_in ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[9px] font-display uppercase tracking-wider">
                        <CheckCircle2 className="w-3 h-3" />
                        In
                      </span>
                    ) : past ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[9px] font-display uppercase tracking-wider">
                        No-show
                      </span>
                    ) : live ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[9px] font-display uppercase tracking-wider">
                        <Circle className="w-3 h-3" />
                        Now
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-card border border-border/40 text-muted-foreground text-[9px] font-display uppercase tracking-wider">
                        Upcoming
                      </span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </motion.div>
  );
};

export default TodaysBookingsWidget;
