import { useState } from "react";
import { motion } from "framer-motion";
import { Clock, MapPin, Ticket, Users } from "lucide-react";

// ─── Expandable description ─────────────────────────────────────────────
const EXPAND_THRESHOLD = 120;
const ExpandableDescription = ({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) => {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > EXPAND_THRESHOLD;

  if (!isLong) {
    return <p className={`text-xs text-muted-foreground font-body ${className}`}>{text}</p>;
  }

  return (
    <div>
      <p
        className={`text-xs text-muted-foreground font-body whitespace-pre-wrap ${
          expanded ? "" : "line-clamp-2"
        } ${className}`}
      >
        {text}
      </p>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded((v) => !v);
        }}
        className="mt-1 text-[10px] uppercase tracking-widest font-mono text-foreground/70 hover:text-foreground transition-colors"
      >
        {expanded ? "Show less" : "Read more"}
      </button>
    </div>
  );
};

export type EventCardStyle = "glass_chrome" | "date_block" | "ticket_stub" | "boarding_pass";

export const EVENT_CARD_STYLE_OPTIONS: { value: EventCardStyle; label: string }[] = [
  { value: "glass_chrome", label: "Glass · Chrome Border (Boarding Pass Hybrid)" },
  { value: "date_block", label: "Glass · Date Block (Compact)" },
  { value: "ticket_stub", label: "Ticket Stub · Monospaced" },
  { value: "boarding_pass", label: "Boarding Pass · QR Stub" },
];

export interface EventCardData {
  id: string;
  title: string;
  description: string | null;
  event_date: string; // ISO yyyy-mm-dd
  start_time: string; // HH:mm:ss
  end_time: string | null;
  room_title: string | null;
  location?: string | null;
  capacity: number;
  price_cents: number;
  show_price?: boolean;
}

interface CommonProps {
  event: EventCardData;
  confirmed: number;
  isHighlighted?: boolean;
  children: React.ReactNode; // CTA / status block
}

// ─── helpers ────────────────────────────────────────────────────────────
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const parseDateParts = (iso: string) => {
  // iso = "yyyy-mm-dd" — treat as local
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return {
    weekday: WEEKDAYS[dt.getDay()],
    day: String(d).padStart(2, "0"),
    month: MONTHS[(m || 1) - 1],
  };
};

const formatTime = (t: string) => {
  // "HH:mm:ss" -> "10:00 PM"
  if (!t) return "";
  const [hh, mm] = t.split(":").map((n) => parseInt(n, 10));
  if (Number.isNaN(hh)) return t;
  const period = hh >= 12 ? "PM" : "AM";
  const h12 = ((hh + 11) % 12) + 1;
  return `${h12}:${String(mm || 0).padStart(2, "0")} ${period}`;
};

const formatPrice = (cents: number) => (cents > 0 ? `$${(cents / 100).toFixed(0)}` : "Free");
const venueDisplay = (event: EventCardData) =>
  event.location || event.room_title || "TBA";

// ─── VARIANT 2 — Glass · Date Block (compact list card) ─────────────────
export const EventCardCompact = ({ event, confirmed, isHighlighted, children }: CommonProps) => {
  const { weekday, day, month } = parseDateParts(event.event_date);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-2xl overflow-hidden border border-border/50 bg-card/40 backdrop-blur-xl ${
        isHighlighted ? "ring-2 ring-primary/40" : ""
      }`}
    >
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 w-1"
        style={{
          background: "linear-gradient(180deg, hsl(var(--chrome-light)), hsl(var(--chrome-dark)))",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background: "radial-gradient(circle at 100% 0%, hsl(var(--primary) / 0.12), transparent 60%)",
        }}
      />
      <div className="relative flex gap-3 sm:gap-5 p-3 sm:p-5">
        <div className="shrink-0 text-center w-16 sm:w-20 py-2 sm:py-3 rounded-xl bg-background/50 border border-border/40 self-start">
          <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground font-body">{weekday}</p>
          <p className="font-display text-2xl sm:text-3xl font-bold chrome-text leading-none my-1">{day}</p>
          <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground font-body">{month}</p>
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            <h3 className="font-display text-base sm:text-lg font-bold text-foreground leading-tight">{event.title}</h3>
            {event.show_price !== false && (
              <span className="shrink-0 text-[10px] uppercase tracking-wider px-2 py-1 rounded-full border border-border/60 bg-background/40 text-muted-foreground">
                {formatPrice(event.price_cents)}
              </span>
            )}
          </div>
          {event.description && (
            <ExpandableDescription text={event.description} />
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground font-body pt-1">
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" /> {formatTime(event.start_time)}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {venueDisplay(event)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="w-3 h-3" /> {confirmed}/{event.capacity} passes
            </span>
          </div>
          <div className="pt-2">{children}</div>
        </div>
      </div>
    </motion.div>
  );
};

// ─── VARIANT 1 — Glass · Chrome Border (Boarding Pass Hybrid) ──────────
export const EventCardGlassChrome = ({ event, confirmed, isHighlighted, children }: CommonProps) => {
  const { day, month } = parseDateParts(event.event_date);
  const seatsLeft = Math.max(0, event.capacity - confirmed);

  // Deterministic QR-ish pattern from event id (no Math.random — stable across renders)
  const cells = Array.from({ length: 25 }, (_, i) => {
    let h = 0;
    const seed = event.id + ":" + i;
    for (let k = 0; k < seed.length; k++) h = (h * 31 + seed.charCodeAt(k)) >>> 0;
    return h % 100 < 55;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-2xl overflow-hidden p-[1px] ${
        isHighlighted ? "ring-2 ring-primary/40" : ""
      }`}
      style={{
        background:
          "linear-gradient(135deg, hsl(var(--chrome-light) / 0.6), hsl(var(--chrome-dark) / 0.2) 40%, hsl(var(--chrome) / 0.5))",
      }}
    >
      <div className="relative rounded-2xl bg-card/60 backdrop-blur-xl overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            background:
              "radial-gradient(circle at 10% 0%, hsl(var(--chrome-light) / 0.15), transparent 55%), radial-gradient(circle at 90% 100%, hsl(var(--accent) / 0.18), transparent 50%)",
          }}
        />
        <div
          className="relative h-1.5"
          style={{
            background:
              "linear-gradient(90deg, hsl(var(--chrome-dark)), hsl(var(--chrome-light)) 50%, hsl(var(--chrome-dark)))",
          }}
        />

        <div className="relative flex">
          <div className="flex-1 p-4 sm:p-5 min-w-0">
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.25em] sm:tracking-[0.3em] text-muted-foreground font-mono">
                Members Boarding Pass
              </p>
            </div>
            <h3 className="font-display text-lg sm:text-xl font-bold chrome-text leading-tight mb-3 sm:mb-4 truncate">
              {event.title}
            </h3>

            <div className="grid grid-cols-3 gap-2 sm:gap-3 items-center">
              <div className="min-w-0">
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono mb-1">From</p>
                <p className="font-display text-sm sm:text-base font-bold chrome-text leading-none">NOW</p>
                <p className="text-[10px] text-muted-foreground font-mono mt-0.5">Today</p>
              </div>
              <div className="text-center relative">
                <div
                  aria-hidden
                  className="absolute top-1/2 left-0 right-0 -translate-y-1/2 border-t border-dashed border-border/60"
                />
                <span className="relative inline-block px-2 bg-card text-muted-foreground text-xs">✦</span>
              </div>
              <div className="text-right min-w-0">
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono mb-1">To</p>
                <p className="font-display text-sm sm:text-base font-bold chrome-text leading-none truncate">
                  {month} {day}
                </p>
                <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">{formatTime(event.start_time)}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border/50">
              <div className="min-w-0">
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono">Location</p>
                <p className="text-[11px] sm:text-xs font-mono text-foreground mt-0.5 truncate">{venueDisplay(event)}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono">Passes</p>
                <p className="text-[11px] sm:text-xs font-mono text-foreground mt-0.5">{seatsLeft} left</p>
              </div>
              {event.show_price !== false && (
                <div className="min-w-0">
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono">Price</p>
                  <p className="text-[11px] sm:text-xs font-mono text-foreground mt-0.5">{formatPrice(event.price_cents)}</p>
                </div>
              )}
            </div>

            {event.description && (
              <div className="mt-3 sm:mt-4">
                <ExpandableDescription text={event.description} className="leading-relaxed" />
              </div>
            )}
          </div>

          {/* Stub side with QR-like glyph */}
          <div className="relative shrink-0 w-28 border-l border-dashed border-border/70 bg-background/40 hidden sm:flex flex-col items-center justify-center p-3 gap-2">
            <div
              aria-hidden
              className="absolute -top-2 -left-2 w-4 h-4 rounded-full bg-background border border-border/60"
            />
            <div
              aria-hidden
              className="absolute -bottom-2 -left-2 w-4 h-4 rounded-full bg-background border border-border/60"
            />
            <div
              className="w-16 h-16 rounded-md grid grid-cols-5 grid-rows-5 gap-[2px] p-1.5"
              style={{
                background:
                  "linear-gradient(135deg, hsl(var(--chrome-light) / 0.15), hsl(var(--chrome-dark) / 0.1))",
              }}
            >
              {cells.map((on, i) => (
                <div
                  key={i}
                  className="rounded-[1px]"
                  style={{ background: on ? "hsl(var(--foreground))" : "transparent" }}
                />
              ))}
            </div>
            <p className="text-[8px] uppercase tracking-widest text-muted-foreground font-mono text-center">
              Scan at door
            </p>
          </div>
        </div>

        <div className="relative px-4 sm:px-5 pb-4 sm:pb-5 pt-1">{children}</div>
      </div>
    </motion.div>
  );
};

// Alias so admin/registry naming stays clean
export const EventCardDateBlock = EventCardCompact;

// ─── VARIANT 3 — Ticket Stub · Monospaced ───────────────────────────────
export const EventCardTicketStub = ({ event, confirmed, isHighlighted, children }: CommonProps) => {
  const { day, month } = parseDateParts(event.event_date);
  const seatsLeft = Math.max(0, event.capacity - confirmed);
  const refNum = `RC-${month}${day}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative flex bg-card border border-border/60 rounded-lg overflow-hidden ${
        isHighlighted ? "ring-2 ring-primary/40" : ""
      }`}
    >
      <div className="relative flex flex-col justify-between p-3 sm:p-4 w-20 sm:w-24 border-r border-dashed border-border/70 bg-background/40 shrink-0">
        <div aria-hidden className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-background border border-border/60" />
        <div aria-hidden className="absolute -bottom-2 -right-2 w-4 h-4 rounded-full bg-background border border-border/60" />
        <div className="text-center">
          <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-mono">Admit</p>
          <p className="font-display text-xl sm:text-2xl font-bold chrome-text leading-none mt-1">{day}</p>
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono mt-1">{month}</p>
        </div>
        <div className="text-center mt-2">
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono truncate">#{refNum}</p>
        </div>
      </div>
      <div className="flex-1 p-4 sm:p-5 space-y-3 min-w-0">
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-mono mb-1">
              Replay Club Presents
            </p>
            <h3 className="font-display text-base sm:text-lg font-bold text-foreground leading-tight truncate">{event.title}</h3>
          </div>
          {event.show_price !== false && (
            <p className="font-mono text-xs sm:text-sm font-bold text-foreground shrink-0">
              {event.price_cents > 0 ? `$${(event.price_cents / 100).toFixed(2)}` : "FREE"}
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 sm:gap-x-4 pt-2 border-t border-dashed border-border/50 text-[11px] font-mono">
          <div className="min-w-0">
            <p className="text-muted-foreground/70 uppercase text-[9px] tracking-widest">Date</p>
            <p className="text-foreground">{month} {day}</p>
          </div>
          <div className="min-w-0">
            <p className="text-muted-foreground/70 uppercase text-[9px] tracking-widest">Doors</p>
            <p className="text-foreground truncate">{formatTime(event.start_time)}</p>
          </div>
          <div className="min-w-0">
            <p className="text-muted-foreground/70 uppercase text-[9px] tracking-widest">Location</p>
            <p className="text-foreground truncate">{venueDisplay(event)}</p>
          </div>
          <div className="min-w-0">
            <p className="text-muted-foreground/70 uppercase text-[9px] tracking-widest">Passes</p>
            <p className="text-foreground truncate">{seatsLeft === 0 ? "SOLD OUT" : `${seatsLeft} left`}</p>
          </div>
        </div>
        <div className="pt-1 inline-flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
          <Ticket className="w-3 h-3 shrink-0" /> Show this ticket at the door
        </div>
        {event.description && (
          <ExpandableDescription text={event.description} className="leading-relaxed" />
        )}
        <div>{children}</div>
      </div>
    </motion.div>
  );
};

// ─── VARIANT 4 — Boarding Pass · QR Stub (no chrome shell) ──────────────
export const EventCardBoardingPass = ({ event, confirmed, isHighlighted, children }: CommonProps) => {
  const { day, month } = parseDateParts(event.event_date);
  const seatsLeft = Math.max(0, event.capacity - confirmed);

  const cells = Array.from({ length: 25 }, (_, i) => {
    let h = 0;
    const seed = event.id + ":" + i;
    for (let k = 0; k < seed.length; k++) h = (h * 31 + seed.charCodeAt(k)) >>> 0;
    return h % 100 < 55;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative bg-card border border-border/60 rounded-xl overflow-hidden ${
        isHighlighted ? "ring-2 ring-primary/40" : ""
      }`}
    >
      <div
        className="h-1.5"
        style={{
          background:
            "linear-gradient(90deg, hsl(var(--chrome-dark)), hsl(var(--chrome-light)) 50%, hsl(var(--chrome-dark)))",
        }}
      />
      <div className="flex">
        <div className="flex-1 p-4 sm:p-5 min-w-0">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.25em] sm:tracking-[0.3em] text-muted-foreground font-mono">
              Members Boarding Pass
            </p>
          </div>
          <h3 className="font-display text-lg sm:text-xl font-bold text-foreground leading-tight mb-3 sm:mb-4 truncate">
            {event.title}
          </h3>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 items-center">
            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono mb-1">From</p>
              <p className="font-display text-sm sm:text-base font-bold chrome-text leading-none">NOW</p>
              <p className="text-[10px] text-muted-foreground font-mono mt-0.5">Today</p>
            </div>
            <div className="text-center relative">
              <div aria-hidden className="absolute top-1/2 left-0 right-0 -translate-y-1/2 border-t border-dashed border-border/60" />
              <span className="relative inline-block px-2 bg-card text-muted-foreground text-xs">✦</span>
            </div>
            <div className="text-right min-w-0">
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono mb-1">To</p>
              <p className="font-display text-sm sm:text-base font-bold chrome-text leading-none truncate">{month} {day}</p>
              <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">{formatTime(event.start_time)}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border/50">
            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono">Location</p>
              <p className="text-[11px] sm:text-xs font-mono text-foreground mt-0.5 truncate">{venueDisplay(event)}</p>
            </div>
            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono">Passes</p>
              <p className="text-[11px] sm:text-xs font-mono text-foreground mt-0.5">{seatsLeft} left</p>
            </div>
            {event.show_price !== false && (
              <div className="min-w-0">
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono">Price</p>
                <p className="text-[11px] sm:text-xs font-mono text-foreground mt-0.5">{formatPrice(event.price_cents)}</p>
              </div>
            )}
          </div>
          {event.description && (
            <div className="mt-3 sm:mt-4">
              <ExpandableDescription text={event.description} className="leading-relaxed" />
            </div>
          )}
        </div>
        <div className="relative shrink-0 w-28 border-l border-dashed border-border/70 bg-background/40 hidden sm:flex flex-col items-center justify-center p-3 gap-2">
          <div aria-hidden className="absolute -top-2 -left-2 w-4 h-4 rounded-full bg-background border border-border/60" />
          <div aria-hidden className="absolute -bottom-2 -left-2 w-4 h-4 rounded-full bg-background border border-border/60" />
          <div
            className="w-16 h-16 rounded-md grid grid-cols-5 grid-rows-5 gap-[2px] p-1.5"
            style={{
              background:
                "linear-gradient(135deg, hsl(var(--chrome-light) / 0.15), hsl(var(--chrome-dark) / 0.1))",
            }}
          >
            {cells.map((on, i) => (
              <div key={i} className="rounded-[1px]" style={{ background: on ? "hsl(var(--foreground))" : "transparent" }} />
            ))}
          </div>
          <p className="text-[8px] uppercase tracking-widest text-muted-foreground font-mono text-center">Scan at door</p>
        </div>
      </div>
      <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-1">{children}</div>
    </motion.div>
  );
};

// ─── Registry / picker ──────────────────────────────────────────────────
export const pickEventCard = (style: EventCardStyle | null | undefined) => {
  switch (style) {
    case "date_block":
      return EventCardDateBlock;
    case "ticket_stub":
      return EventCardTicketStub;
    case "boarding_pass":
      return EventCardBoardingPass;
    case "glass_chrome":
    default:
      return EventCardGlassChrome;
  }
};
