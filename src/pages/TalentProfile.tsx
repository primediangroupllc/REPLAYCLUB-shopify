import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Instagram, Music, Mail, MapPin, Disc3, Loader2, Headphones } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import PageBreadcrumbs from "@/components/PageBreadcrumbs";

interface TalentData {
  id: string;
  alias: string;
  name: string | null;
  genre: string;
  bio: string;
  image_url: string;
  instagram_url: string | null;
  soundcloud_url: string | null;
  spotify_url: string | null;
  location: string | null;
  preview_track_url: string | null;
}

const TalentProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [talent, setTalent] = useState<TalentData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      
      // Try UUID lookup first, then alias (slug) lookup
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      
      let query = supabase.from("talent").select("*").eq("visible", true);
      
      if (isUuid) {
        query = query.eq("id", id);
      } else {
        query = query.ilike("alias", id.replace(/-/g, " "));
      }
      
      const { data } = await query.single();
      if (data) setTalent(data as TalentData);
      setLoading(false);
    };
    load();
  }, [id]);

  const handleBook = () => {
    if (!talent) return;
    const subject = encodeURIComponent(`DJ Booking Inquiry — ${talent.alias}`);
    const body = encodeURIComponent(
      `Hi Replay Club,\n\nI'd like to inquire about booking ${talent.alias} for an event.\n\nEvent details:\n- Date: \n- Venue: \n- Set length: \n- Budget: \n\nThanks!`
    );
    window.location.href = `mailto:replayclubrecords@gmail.com?subject=${subject}&body=${body}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!talent) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground text-sm">Artist not found.</p>
        <button
          onClick={() => navigate("/")}
          className="text-xs font-display uppercase tracking-wider text-foreground border-b border-border pb-0.5"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero image */}
      <div className="relative w-full h-[60vh] min-h-[350px] max-h-[500px] overflow-hidden">
        <img
          src={talent.image_url}
          alt={talent.alias}
          className="w-full h-full object-cover"
          style={{
            objectPosition: talent.alias === "SEREDA" ? "center 5%" : "center center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative -mt-16 px-5 pb-12 max-w-lg mx-auto">
        <PageBreadcrumbs
          className="mb-4"
          items={[
            { label: "Home", to: "/" },
            { label: "Talent", to: "/talent" },
            { label: talent.alias },
          ]}
        />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          {/* Name & meta */}
          <div className="space-y-2">
            <h1 className="font-display text-2xl sm:text-3xl font-bold chrome-text uppercase tracking-[0.08em] sm:tracking-[0.12em] break-words leading-tight">
              {talent.alias}
            </h1>
            {talent.name && (
              <p className="text-muted-foreground text-[11px] sm:text-xs font-body break-words">{talent.name}</p>
            )}
          </div>

          {/* Tags: genre & location */}
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/40 bg-muted/30 text-[10px] font-display uppercase tracking-wider text-muted-foreground">
              <Disc3 className="w-3 h-3" />
              {talent.genre}
            </span>
            {talent.location && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/40 bg-muted/30 text-[10px] font-display uppercase tracking-wider text-muted-foreground">
                <MapPin className="w-3 h-3" />
                {talent.location}
              </span>
            )}
          </div>

          {/* Divider */}
          <div
            className="w-full h-px"
            style={{
              background: "linear-gradient(90deg, transparent, hsl(0 0% 25%), transparent)",
            }}
          />

          {/* Bio */}
          <div className="space-y-2">
            <h2 className="font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              About
            </h2>
            <p className="text-foreground/80 text-sm font-body leading-relaxed">
              {talent.bio}
            </p>
           </div>

          {/* Audio Preview */}
          {talent.preview_track_url && (
            <>
              <div
                className="w-full h-px"
                style={{
                  background: "linear-gradient(90deg, transparent, hsl(0 0% 25%), transparent)",
                }}
              />
              <div className="space-y-3">
                <h2 className="font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5">
                  <Headphones className="w-3 h-3" />
                  Preview
                </h2>
                <div className="rounded-lg overflow-hidden border border-border/30">
                  {talent.preview_track_url.includes("spotify.com") ? (
                    <iframe
                      width="100%"
                      height="152"
                      frameBorder="0"
                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                      loading="lazy"
                      src={`https://open.spotify.com/embed/track/${talent.preview_track_url.split("/track/")[1]?.split("?")[0]}?utm_source=generator&theme=0`}
                    />
                  ) : (
                    <iframe
                      width="100%"
                      height="120"
                      scrolling="no"
                      frameBorder="no"
                      allow="autoplay"
                      src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(talent.preview_track_url)}&color=%23ff0000&auto_play=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false`}
                    />
                  )}
                </div>
              </div>
            </>
          )}

          {/* Divider */}
          <div
            className="w-full h-px"
            style={{
              background: "linear-gradient(90deg, transparent, hsl(0 0% 25%), transparent)",
            }}
          />

          {/* Social links */}
          <div className="space-y-3">
            <h2 className="font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Connect
            </h2>
            <div className="flex flex-col gap-2">
              {talent.instagram_url && (
                <a
                  href={talent.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border/30 bg-muted/20 hover:bg-muted/40 transition-colors group"
                >
                  <Instagram className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  <span className="text-xs font-display uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">
                    Instagram
                  </span>
                </a>
              )}
              {talent.soundcloud_url && (
                <a
                  href={talent.soundcloud_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border/30 bg-muted/20 hover:bg-muted/40 transition-colors group"
                >
                  <Music className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  <span className="text-xs font-display uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">
                    SoundCloud
                  </span>
                </a>
              )}
              {talent.spotify_url && (
                <a
                  href={talent.spotify_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border/30 bg-muted/20 hover:bg-muted/40 transition-colors group"
                >
                  <Disc3 className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  <span className="text-xs font-display uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">
                    Spotify
                  </span>
                </a>
              )}
            </div>
          </div>

          {/* Book Button */}
          <button
            onClick={handleBook}
            className="w-full chrome-btn font-display font-semibold text-[10px] uppercase tracking-[0.15em] px-4 py-3 rounded-md flex items-center justify-center gap-2 mt-4"
          >
            <Mail className="w-3.5 h-3.5" />
            Book {talent.alias}
          </button>
        </motion.div>
      </div>
    </div>
  );
};

export default TalentProfile;
