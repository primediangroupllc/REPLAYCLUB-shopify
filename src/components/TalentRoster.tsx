import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Instagram, Music, Mail, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface TalentProfile {
  id: string;
  alias: string;
  name: string | null;
  genre: string;
  bio: string;
  image_url: string;
  instagram_url: string | null;
  soundcloud_url: string | null;
}

const TalentRoster = () => {
  const navigate = useNavigate();
  // Cached via React Query — won't refetch when user navigates away and back
  // within the staleTime window (5 min, set in App.tsx).
  const { data: talent = [], isLoading: loading } = useQuery({
    queryKey: ["talent", "visible"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("talent")
        .select("*")
        .eq("visible", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TalentProfile[];
    },
  });

  const handleBook = (dj: TalentProfile) => {
    const subject = encodeURIComponent(`DJ Booking Inquiry — ${dj.alias}`);
    const body = encodeURIComponent(
      `Hi Replay Club,\n\nI'd like to inquire about booking ${dj.alias} for an event.\n\nEvent details:\n- Date: \n- Venue: \n- Set length: \n- Budget: \n\nThanks!`
    );
    window.location.href = `mailto:replayclubrecords@gmail.com?subject=${subject}&body=${body}`;
  };

  const handleShare = (e: React.MouseEvent, dj: TalentProfile) => {
    e.stopPropagation();
    const slug = dj.alias.toLowerCase().replace(/\s+/g, "-");
    const url = `${window.location.origin}/bookings/${slug}`;
    if (navigator.share) {
      navigator.share({ title: `${dj.alias} — Replay Club`, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      toast.success("Link copied!");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (talent.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground text-sm">No talent to display yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center space-y-3"
      >
        <h2 className="font-display text-2xl font-bold chrome-text uppercase tracking-[0.15em]">
          Talent Roster
        </h2>
        <div
          className="mx-auto w-16 h-px"
          style={{ background: "linear-gradient(90deg, transparent, hsl(0 0% 60%), transparent)" }}
        />
      </motion.div>

      {/* DJ Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {talent.map((dj, i) => (
          <motion.div
            key={dj.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.1, duration: 0.5 }}
            className="card-premium group relative rounded-xl overflow-hidden cursor-pointer transition-all duration-500"
            onClick={() => navigate(`/talent/${dj.id}`)}
          >
            {/* Image */}
            <div className="relative aspect-[4/3] overflow-hidden">
              <img
                src={dj.image_url}
                alt={dj.alias}
                className="w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-105 transition-all duration-700"
                style={{ objectPosition: dj.alias === 'SEREDA' ? 'center 5%' : 'center center' }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

              {/* Social links */}
              <div className="absolute top-3 right-3 flex gap-2">
                <button
                  onClick={(e) => handleShare(e, dj)}
                  className="w-7 h-7 rounded-full border border-[hsl(0_0%_30%)] bg-black/60 backdrop-blur-sm flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  title="Share profile"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>
                {dj.instagram_url && (
                  <a
                    href={dj.instagram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="w-7 h-7 rounded-full border border-[hsl(0_0%_30%)] bg-black/60 backdrop-blur-sm flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Instagram className="w-3.5 h-3.5" />
                  </a>
                )}
                {dj.soundcloud_url && (
                  <a
                    href={dj.soundcloud_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="w-7 h-7 rounded-full border border-[hsl(0_0%_30%)] bg-black/60 backdrop-blur-sm flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Music className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="p-4 space-y-3">
              <div>
                <h3 className="font-display text-base font-bold text-foreground tracking-wide">
                  {dj.alias}
                </h3>
                <p className="text-muted-foreground text-[10px] font-display uppercase tracking-wider mt-1">
                  {dj.genre}
                </p>
              </div>

              {/* Book Button */}
              <button
                onClick={() => handleBook(dj)}
                className="w-full chrome-btn font-display font-semibold text-[10px] uppercase tracking-[0.15em] px-4 py-2.5 rounded-md flex items-center justify-center gap-2"
              >
                <Mail className="w-3.5 h-3.5" />
                Book {dj.alias}
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Footer CTA */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-center pt-4 space-y-2"
      >
        <p className="text-muted-foreground text-[10px] font-body uppercase tracking-[0.2em]">
          Want to join the roster?
        </p>
        <a
          href="mailto:replayclubrecords@gmail.com?subject=Talent%20Inquiry"
          className="inline-block text-foreground text-[10px] font-display uppercase tracking-[0.15em] border-b border-[hsl(0_0%_40%)] hover:border-foreground transition-colors pb-0.5"
        >
          Apply Now →
        </a>
      </motion.div>
    </div>
  );
};

export default TalentRoster;
