import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { findPhotographerPackage } from "@/lib/bookingConstants";

interface Booking {
  id: string;
  room_title: string;
  booking_date: string;
  booking_time: string;
  payment_status: string;
  amount_cents: number;
  customer_name: string;
  customer_email: string;
  layout?: string | null;
  lighting?: string | null;
  equipment?: unknown;
}

const formatStyle = (s?: string | null) =>
  s ? s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "";

interface BlockedDate {
  id: string;
  blocked_date: string;
  reason: string | null;
  room_title: string | null;
}

interface AdminCalendarViewProps {
  bookings: Booking[];
  blockedDates: BlockedDate[];
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const AdminCalendarView = ({ bookings, blockedDates }: AdminCalendarViewProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const calendarDays = useMemo(() => {
    const days: { date: string; day: number; isCurrentMonth: boolean }[] = [];
    // Previous month padding
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({ date: dateStr, day: d, isCurrentMonth: false });
    }
    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({ date: dateStr, day: d, isCurrentMonth: true });
    }
    // Next month padding
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const dateStr = `${year}-${String(month + 2).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({ date: dateStr, day: d, isCurrentMonth: false });
    }
    return days;
  }, [year, month, daysInMonth, firstDayOfWeek]);

  const bookingsByDate = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    bookings.forEach((b) => {
      if (!map[b.booking_date]) map[b.booking_date] = [];
      map[b.booking_date].push(b);
    });
    return map;
  }, [bookings]);

  const blockedByDate = useMemo(() => {
    const map: Record<string, BlockedDate[]> = {};
    blockedDates.forEach((bd) => {
      if (!map[bd.blocked_date]) map[bd.blocked_date] = [];
      map[bd.blocked_date].push(bd);
    });
    return map;
  }, [blockedDates]);

  const today = new Date().toISOString().split("T")[0];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const selectedBookings = selectedDate ? bookingsByDate[selectedDate] || [] : [];
  const selectedBlocked = selectedDate ? blockedByDate[selectedDate] || [] : [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 rounded-md hover:bg-card transition-colors">
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <h3 className="font-display text-sm font-bold text-foreground uppercase tracking-wider">
          {currentDate.toLocaleString("default", { month: "long", year: "numeric" })}
        </h3>
        <button onClick={nextMonth} className="p-2 rounded-md hover:bg-card transition-colors">
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-px">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-[10px] font-display uppercase tracking-wider text-muted-foreground py-2">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-border/20 rounded-lg overflow-hidden">
        {calendarDays.map((cell, i) => {
          const dayBookings = bookingsByDate[cell.date] || [];
          const dayBlocked = blockedByDate[cell.date] || [];
          const isToday = cell.date === today;
          const isSelected = cell.date === selectedDate;
          const hasBookings = dayBookings.length > 0;
          const isBlocked = dayBlocked.length > 0;

          return (
            <button
              key={i}
              onClick={() => cell.isCurrentMonth && setSelectedDate(isSelected ? null : cell.date)}
              className={cn(
                "relative h-16 md:h-20 p-1 text-left transition-all",
                cell.isCurrentMonth ? "bg-card hover:bg-card/80" : "bg-background/50",
                isSelected && "ring-1 ring-primary bg-primary/5",
                !cell.isCurrentMonth && "opacity-40"
              )}
            >
              <span
                className={cn(
                  "text-[11px] font-display font-semibold",
                  isToday
                    ? "bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center"
                    : "text-foreground"
                )}
              >
                {cell.day}
              </span>
              {hasBookings && (
                <div className="mt-0.5 space-y-0.5">
                  {dayBookings.slice(0, 2).map((b, j) => (
                    <div
                      key={j}
                      className="text-[8px] font-body truncate px-1 py-0.5 rounded bg-primary/10 text-primary"
                    >
                      {b.customer_name.split(" ")[0]}
                    </div>
                  ))}
                  {dayBookings.length > 2 && (
                    <div className="text-[8px] font-body text-muted-foreground px-1">
                      +{dayBookings.length - 2} more
                    </div>
                  )}
                </div>
              )}
              {isBlocked && !hasBookings && (
                <div className="mt-0.5 text-[8px] font-body px-1 py-0.5 rounded bg-destructive/10 text-destructive truncate">
                  Blocked
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day detail */}
      {selectedDate && (
        <div className="chrome-surface rounded-lg p-4 space-y-3">
          <h4 className="font-display text-sm font-semibold text-foreground">
            {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </h4>

          {selectedBlocked.length > 0 && (
            <div className="space-y-1">
              {selectedBlocked.map((bd) => (
                <div key={bd.id} className="flex items-center gap-2 text-xs font-body text-destructive bg-destructive/5 rounded px-3 py-2">
                  <span className="w-2 h-2 rounded-full bg-destructive" />
                  Blocked{bd.room_title ? ` (${bd.room_title})` : " (All rooms)"}: {bd.reason || "No reason given"}
                </div>
              ))}
            </div>
          )}

          {selectedBookings.length > 0 ? (
            <div className="space-y-2">
              {selectedBookings.map((b) => (
                <div key={b.id} className="flex flex-col gap-1.5 p-3 bg-card rounded-md border border-border/30">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-display text-xs font-semibold text-foreground flex items-center gap-1.5">
                        {b.customer_name}
                        {findPhotographerPackage(b.equipment) && (
                          <span
                            title={`Schedule photographer: ${findPhotographerPackage(b.equipment)}`}
                            className="inline-flex items-center gap-1 text-[8px] font-display uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/15 text-primary"
                          >
                            <Camera className="w-2.5 h-2.5" />
                            Photog
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-body">
                        {b.room_title} • {b.booking_time}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-[9px] font-display uppercase tracking-wider px-1.5 py-0.5 rounded-full",
                        b.payment_status === "paid"
                          ? "bg-green-500/10 text-green-400"
                          : b.payment_status === "promo"
                          ? "bg-primary/10 text-primary"
                          : "bg-yellow-500/10 text-yellow-400"
                      )}
                    >
                      {b.payment_status}
                    </span>
                  </div>
                  {(b.layout || b.lighting) && (
                    <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/30">
                      {b.layout && (
                        <span className="text-[9px] font-display uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-accent/40 text-accent-foreground">
                          Layout: {formatStyle(b.layout)}
                        </span>
                      )}
                      {b.lighting && (
                        <span className="text-[9px] font-display uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-accent/40 text-accent-foreground">
                          Lighting: {formatStyle(b.lighting)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : selectedBlocked.length === 0 ? (
            <p className="text-sm text-muted-foreground font-body">No bookings on this date.</p>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default AdminCalendarView;
