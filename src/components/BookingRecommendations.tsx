import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles } from "lucide-react";

interface Recommendation {
  roomTitle: string;
  preferredTime: string;
  count: number;
}

interface BookingRecommendationsProps {
  onSelectRoom?: (roomTitle: string) => void;
}

const BookingRecommendations = ({ onSelectRoom }: BookingRecommendationsProps) => {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecommendations = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.email) { setLoading(false); return; }

      const { data: bookings } = await supabase
        .from("bookings")
        .select("room_title, booking_time")
        .in("payment_status", ["paid", "promo"])
        .limit(50);

      if (!bookings || bookings.length < 2) { setLoading(false); return; }

      // Aggregate by room
      const roomCounts: Record<string, { count: number; times: Record<string, number> }> = {};
      for (const b of bookings) {
        if (!roomCounts[b.room_title]) roomCounts[b.room_title] = { count: 0, times: {} };
        roomCounts[b.room_title].count++;
        roomCounts[b.room_title].times[b.booking_time] = (roomCounts[b.room_title].times[b.booking_time] || 0) + 1;
      }

      const recs = Object.entries(roomCounts)
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, 3)
        .map(([roomTitle, data]) => {
          const preferredTime = Object.entries(data.times).sort(([, a], [, b]) => b - a)[0]?.[0] || "";
          return { roomTitle, preferredTime, count: data.count };
        });

      setRecommendations(recs);
      setLoading(false);
    };
    fetchRecommendations();
  }, []);

  if (loading || recommendations.length === 0) return null;

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-md p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        <span className="text-[10px] font-display font-semibold uppercase tracking-[0.15em] text-primary">
          Based on your history
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {recommendations.map((rec) => (
          <button
            key={rec.roomTitle}
            onClick={() => onSelectRoom?.(rec.roomTitle)}
            className="text-[10px] font-body px-2.5 py-1 rounded-full border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
          >
            {rec.roomTitle} · {rec.preferredTime}
          </button>
        ))}
      </div>
    </div>
  );
};

export default BookingRecommendations;
