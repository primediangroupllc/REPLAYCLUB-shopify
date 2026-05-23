import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Calendar, MapPin, Users, Ticket, Clock } from "lucide-react";
import logo from "@/assets/logo.png";

type SampleEvent = {
  id: string;
  title: string;
  tag: string;
  date: string;
  weekday: string;
  day: string;
  month: string;
  time: string;
  end: string;
  room: string;
  capacity: number;
  confirmed: number;
  price: number;
  description: string;
};

const sampleEvents: SampleEvent[] = [
  {
    id: "evt-1",
    title: "Late Night Listening · Vol. 3",
    tag: "Members Only",
    date: "Sat · Jul 12",
    weekday: "Sat",
    day: "12",
    month: "Jul",
    time: "10:00 PM",
    end: "1:00 AM",
    room: "Studio A",
    capacity: 24,
    confirmed: 17,
    price: 15,
    description:
      "Hi-fi vinyl listening session with curated rare grooves. Limited capacity, late seating not permitted.",
  },
  {
    id: "evt-2",
    title: "Open Decks · Summer Edition",
    tag: "All Welcome",
    date: "Fri · Jul 18",
    weekday: "Fri",
    day: "18",
    month: "Jul",
    time: "8:00 PM",
    end: "11:00 PM",
    room: "Main Floor",
    capacity: 40,
    confirmed: 12,
    price: 0,
    description:
      "Bring a USB or vinyl. 20-minute slots, signups at the door. Free entry, drinks at the bar.",
  },
  {
    id: "evt-3",
    title: "FUMIX Showcase Night",
    tag: "Showcase",
    date: "Sat · Aug 02",
    weekday: "Sat",
    day: "02",
    month: "Aug",
    time: "9:30 PM",
    end: "12:30 AM",
    room: "Studio A",
    capacity: 30,
    confirmed: 30,
    price: 25,
    description:
      "Three-hour set from FUMIX with surprise b2b guests. Doors at 9, set starts sharp at 9:30.",
  },
];

const VariantWrapper = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-body">
        {label}
      </span>
      <div className="flex-1 h-px bg-border/40" />
    </div>
    {children}
  </div>
);

// ─────────────────────────── VARIANT 1 ───────────────────────────
// Glass / Liquid Chrome — frosted, metallic gradient border
const GlassChromeCard = ({ event }: { event: SampleEvent; idx: number }) => {
  const seatsLeft = Math.max(0, event.capacity - event.confirmed);
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
      className="relative rounded-2xl overflow-hidden p-[1px]"
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
          <div className="flex-1 p-5 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">
                Members Boarding Pass
              </p>
            </div>
            <h3 className="font-display text-xl font-bold chrome-text leading-tight mb-4 truncate">
              {event.title}
            </h3>

            <div className="grid grid-cols-3 gap-3 items-center">
              <div>
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono mb-1">From</p>
                <p className="font-display text-base font-bold chrome-text leading-none">NOW</p>
                <p className="text-[10px] text-muted-foreground font-mono mt-0.5">Today</p>
              </div>
              <div className="text-center relative">
                <div
                  aria-hidden
                  className="absolute top-1/2 left-0 right-0 -translate-y-1/2 border-t border-dashed border-border/60"
                />
                <span className="relative inline-block px-2 bg-card text-muted-foreground text-xs">✦</span>
              </div>
              <div className="text-right">
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono mb-1">To</p>
                <p className="font-display text-base font-bold chrome-text leading-none">
                  {event.month.toUpperCase()} {event.day}
                </p>
                <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{event.time}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border/50">
              <div className="min-w-0">
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono">Room</p>
                <p className="text-xs font-mono text-foreground mt-0.5 truncate">{event.room}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono">Seats</p>
                <p className="text-xs font-mono text-foreground mt-0.5">
                  {seatsLeft === 0 ? "SOLD OUT" : `${seatsLeft} left`}
                </p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono">Price</p>
                <p className="text-xs font-mono text-foreground mt-0.5">
                  {event.price > 0 ? `$${event.price.toFixed(2)}` : "FREE"}
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground font-body leading-relaxed mt-4 line-clamp-2">
              {event.description}
            </p>
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

        <div className="relative px-5 pb-5 pt-1">
          <button className="chrome-btn w-full py-2.5 rounded-md text-[11px] font-mono uppercase tracking-[0.2em] font-semibold">
            {seatsLeft === 0
              ? "Join Waitlist"
              : event.price > 0
              ? `Board · $${event.price}`
              : "Board · Free"}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ─────────────────────────── VARIANT 2 ───────────────────────────
// Glass + side accent bar with big date block
const GlassDateBlockCard = ({ event }: { event: SampleEvent }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className="relative rounded-2xl overflow-hidden border border-border/50 bg-card/40 backdrop-blur-xl"
  >
    <div
      aria-hidden
      className="absolute inset-y-0 left-0 w-1"
      style={{
        background:
          "linear-gradient(180deg, hsl(var(--chrome-light)), hsl(var(--chrome-dark)))",
      }}
    />
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-40"
      style={{
        background:
          "radial-gradient(circle at 100% 0%, hsl(var(--primary) / 0.12), transparent 60%)",
      }}
    />
    <div className="relative flex gap-5 p-5">
      <div className="shrink-0 text-center w-20 py-3 rounded-xl bg-background/50 border border-border/40 self-start">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-body">
          {event.weekday}
        </p>
        <p className="font-display text-3xl font-bold chrome-text leading-none my-1">
          {event.day}
        </p>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-body">
          {event.month}
        </p>
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-lg font-bold text-foreground leading-tight">
            {event.title}
          </h3>
          <span className="shrink-0 text-[10px] uppercase tracking-wider px-2 py-1 rounded-full border border-border/60 bg-background/40 text-muted-foreground">
            {event.price > 0 ? `$${event.price}` : "Free"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground font-body line-clamp-2">
          {event.description}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground font-body pt-1">
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3 h-3" /> {event.time}
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {event.room}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="w-3 h-3" /> {event.confirmed}/{event.capacity}
          </span>
        </div>
        <button className="chrome-btn-outline w-full mt-2 py-2 rounded-lg text-[11px] font-display uppercase tracking-widest font-semibold">
          {event.confirmed >= event.capacity ? "Join Waitlist" : "Reserve Seat"}
        </button>
      </div>
    </div>
  </motion.div>
);

// ─────────────────────────── VARIANT 3 ───────────────────────────
// Minimal Ticket Stub — perforated edge with monospaced details
const TicketStubCard = ({ event, idx }: { event: SampleEvent; idx: number }) => {
  const seatsLeft = Math.max(0, event.capacity - event.confirmed);
  const stubNum = String(idx + 1).padStart(2, "0");
  const refNum = `RC-${event.month.toUpperCase()}${event.day}`;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative flex bg-card border border-border/60 rounded-lg overflow-hidden"
    >
      {/* Stub side */}
      <div className="relative flex flex-col justify-between p-4 w-24 border-r border-dashed border-border/70 bg-background/40">
        <div
          aria-hidden
          className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-background border border-border/60"
        />
        <div
          aria-hidden
          className="absolute -bottom-2 -right-2 w-4 h-4 rounded-full bg-background border border-border/60"
        />
        <div className="text-center">
          <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-mono">
            Admit
          </p>
          <p className="font-display text-2xl font-bold chrome-text leading-none mt-1">
            {stubNum}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono">
            #{refNum}
          </p>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 p-5 space-y-3 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-mono mb-1">
              Replay Club Presents
            </p>
            <h3 className="font-display text-lg font-bold text-foreground leading-tight truncate">
              {event.title}
            </h3>
          </div>
          <p className="font-mono text-sm font-bold text-foreground shrink-0">
            {event.price > 0 ? `$${event.price.toFixed(2)}` : "FREE"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 pt-2 border-t border-dashed border-border/50 text-[11px] font-mono">
          <div>
            <p className="text-muted-foreground/70 uppercase text-[9px] tracking-widest">
              Date
            </p>
            <p className="text-foreground">{event.date}</p>
          </div>
          <div>
            <p className="text-muted-foreground/70 uppercase text-[9px] tracking-widest">
              Doors
            </p>
            <p className="text-foreground">{event.time}</p>
          </div>
          <div>
            <p className="text-muted-foreground/70 uppercase text-[9px] tracking-widest">
              Room
            </p>
            <p className="text-foreground">{event.room}</p>
          </div>
          <div>
            <p className="text-muted-foreground/70 uppercase text-[9px] tracking-widest">
              Seats
            </p>
            <p className="text-foreground">
              {seatsLeft === 0 ? "SOLD OUT" : `${seatsLeft} left`}
            </p>
          </div>
        </div>

        <button className="chrome-btn w-full py-2.5 rounded-md text-[11px] font-mono uppercase tracking-[0.2em] font-semibold inline-flex items-center justify-center gap-2">
          <Ticket className="w-3.5 h-3.5" />
          {seatsLeft === 0 ? "Join Waitlist" : "Claim Ticket"}
        </button>
      </div>
    </motion.div>
  );
};

// ─────────────────────────── VARIANT 4 ───────────────────────────
// Boarding-pass style ticket — wide, horizontal, scalloped edge
const BoardingPassCard = ({ event }: { event: SampleEvent }) => {
  // Deterministic QR-like grid (stable across renders)
  const cells = Array.from({ length: 25 }, (_, i) => {
    let h = 0;
    const seed = event.id + ":" + i;
    for (let k = 0; k < seed.length; k++) h = (h * 31 + seed.charCodeAt(k)) >>> 0;
    return h % 100 < 55;
  });
  const seatsLeft = Math.max(0, event.capacity - event.confirmed);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative bg-card border border-border/60 rounded-xl overflow-hidden"
    >
      {/* Top metallic strip */}
      <div
        className="h-1.5"
        style={{
          background:
            "linear-gradient(90deg, hsl(var(--chrome-dark)), hsl(var(--chrome-light)) 50%, hsl(var(--chrome-dark)))",
        }}
      />

      <div className="flex">
        <div className="flex-1 p-5 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">
              Members Boarding Pass
            </p>
          </div>
          <h3 className="font-display text-xl font-bold text-foreground leading-tight mb-4 truncate">
            {event.title}
          </h3>

          <div className="grid grid-cols-3 gap-3 items-center">
            <div>
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono mb-1">
                From
              </p>
              <p className="font-display text-base font-bold chrome-text leading-none">
                NOW
              </p>
              <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                Today
              </p>
            </div>
            <div className="text-center relative">
              <div
                aria-hidden
                className="absolute top-1/2 left-0 right-0 -translate-y-1/2 border-t border-dashed border-border/60"
              />
              <span className="relative inline-block px-2 bg-card text-muted-foreground text-xs">
                ✦
              </span>
            </div>
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono mb-1">
                To
              </p>
              <p className="font-display text-base font-bold chrome-text leading-none">
                {event.month.toUpperCase()} {event.day}
              </p>
              <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                {event.time}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border/50">
            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono">
                Room
              </p>
              <p className="text-xs font-mono text-foreground mt-0.5 truncate">
                {event.room}
              </p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono">
                Seats
              </p>
              <p className="text-xs font-mono text-foreground mt-0.5">
                {seatsLeft === 0 ? "SOLD OUT" : `${seatsLeft} left`}
              </p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono">
                Price
              </p>
              <p className="text-xs font-mono text-foreground mt-0.5">
                {event.price > 0 ? `$${event.price.toFixed(2)}` : "FREE"}
              </p>
            </div>
          </div>
        </div>

        {/* Stub side with QR placeholder */}
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

      <div className="px-5 pb-5">
        <button className="chrome-btn w-full py-2.5 rounded-md text-[11px] font-mono uppercase tracking-[0.2em] font-semibold">
          {seatsLeft === 0
            ? "Join Waitlist"
            : event.price > 0
            ? `Board · $${event.price}`
            : "Board · Free"}
        </button>
      </div>
    </motion.div>
  );
};

const VariantList = ({
  Card,
}: {
  Card: (props: { event: SampleEvent; idx: number }) => JSX.Element;
}) => (
  <div className="space-y-4">
    {sampleEvents.map((evt, idx) => (
      <Card key={evt.id} event={evt} idx={idx} />
    ))}
  </div>
);

const EventsPreview = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border/30">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="w-12" />
          <img src={logo} alt="Replay Club" className="w-24 mix-blend-screen" />
          <div className="w-12" />
        </div>
      </nav>

      <div className="container mx-auto max-w-7xl px-4 py-8 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="font-display text-2xl font-bold tracking-wider uppercase chrome-text">
            Event Card Concepts
          </h1>
          <p className="text-muted-foreground text-sm font-body">
            All 4 variants side-by-side, each rendered with 3 sample events.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
          <VariantWrapper label="01 · Glass · Chrome Border">
            <VariantList Card={GlassChromeCard} />
          </VariantWrapper>

          <VariantWrapper label="02 · Glass · Date Block">
            <VariantList Card={GlassDateBlockCard} />
          </VariantWrapper>

          <VariantWrapper label="03 · Ticket Stub · Monospaced">
            <VariantList Card={TicketStubCard} />
          </VariantWrapper>

          <VariantWrapper label="04 · Boarding Pass · QR Stub">
            <VariantList Card={BoardingPassCard} />
          </VariantWrapper>
        </div>

        <p className="text-center text-[10px] uppercase tracking-[0.3em] text-muted-foreground/70 font-body pt-4">
          Reply with the variant number you want as the new event card.
        </p>
      </div>
    </div>
  );
};

export default EventsPreview;
