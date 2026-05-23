import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface UpcomingBooking {
  id: string;
  room_title: string;
  booking_date: string;
  booking_time: string;
}

interface Props {
  booking: UpcomingBooking;
}

const formatRemaining = (ms: number) => {
  if (ms <= 0) return "Starting now";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds.toString().padStart(2, "0")}s`;
  if (minutes > 0) return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
  return `${seconds}s`;
};

const BookingCountdownBanner = ({ booking }: Props) => {
  const target = new Date(`${booking.booking_date}T${booking.booking_time || "00:00"}`).getTime();
  const [remaining, setRemaining] = useState(target - Date.now());
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setRemaining(target - Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc("get_session_invite_by_booking", {
        p_booking_id: booking.id,
      });
      if (cancelled) return;
      const token = Array.isArray(data) && data[0]?.token ? data[0].token : null;
      setInviteToken(token);
    })();
    return () => {
      cancelled = true;
    };
  }, [booking.id]);

  if (remaining > 24 * 60 * 60 * 1000 || remaining < -2 * 60 * 60 * 1000) return null;

  // Urgency tiers — calm when there's plenty of time, amber under 30min,
  // red under 5min so users heading to the studio see the signal.
  const urgency: "calm" | "soon" | "now" =
    remaining < 5 * 60 * 1000 ? "now"
    : remaining < 30 * 60 * 1000 ? "soon"
    : "calm";
  const accentClass =
    urgency === "now" ? "text-destructive border-destructive/50"
    : urgency === "soon" ? "text-amber-400 border-amber-500/40"
    : "text-primary border-primary/30";
  const accentBorder =
    urgency === "now" ? "border-destructive/50"
    : urgency === "soon" ? "border-amber-500/40"
    : "border-primary/30";
  const labelTextClass =
    urgency === "now" ? "text-destructive"
    : urgency === "soon" ? "text-amber-400"
    : "text-primary/80";

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky top-[60px] z-40 -mx-4 mb-2"
    >
      <div className={`relative overflow-hidden border-y backdrop-blur-xl px-4 py-3 bg-[radial-gradient(120%_80%_at_50%_0%,hsl(0_0%_18%/0.8)_0%,transparent_60%),linear-gradient(180deg,hsl(0_0%_8%)_0%,hsl(0_0%_5%)_100%)] shadow-[0_8px_24px_-8px_hsl(0_0%_0%/0.8)] before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-chrome before:to-transparent ${accentBorder}`}>
        <div className="container mx-auto max-w-lg flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Clock className={`w-4 h-4 shrink-0 animate-pulse ${accentClass.split(" ")[0]}`} />
              <div className="min-w-0">
                <p className={`text-[10px] font-display uppercase tracking-wider ${labelTextClass}`}>
                  {remaining <= 0 ? "Session started" : urgency === "now" ? "Heads up — starting soon" : urgency === "soon" ? "Almost time" : "Session in"}
                </p>
                <p className="font-display text-sm font-bold text-foreground tabular-nums truncate">
                  {formatRemaining(remaining)}
                </p>
              </div>
            </div>
            <div className="text-right min-w-0">
              <p className="text-[10px] font-body text-muted-foreground truncate">{booking.room_title}</p>
              <p className="text-[10px] font-body text-muted-foreground truncate">
                {booking.booking_time}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <span className="flex-1 flex items-center justify-center gap-1.5 text-[10px] font-display uppercase tracking-wider px-3 py-1.5 rounded-md bg-background/40 border border-border/50 text-muted-foreground">
              Pickup details in your confirmation email
            </span>
            {inviteToken && (
              <a
                href={`/session/${inviteToken}`}
                className="flex-1 flex items-center justify-center gap-1.5 text-[10px] font-display uppercase tracking-wider px-3 py-1.5 rounded-md bg-primary/30 border border-primary/50 text-foreground hover:bg-primary/40 transition-colors"
              >
                <Users className="w-3 h-3" />
                Session Invite
              </a>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default BookingCountdownBanner;
