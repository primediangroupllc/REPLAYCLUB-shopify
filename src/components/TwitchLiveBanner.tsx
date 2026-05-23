import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePublicSiteSettings } from "@/hooks/useSiteSettings";

interface StreamInfo {
  title: string;
  viewer_count: number;
  game_name: string;
}

const TwitchLiveBanner = () => {
  const [isLive, setIsLive] = useState(false);
  const [stream, setStream] = useState<StreamInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const hasPlayedSound = useRef(false);
  const { settings } = usePublicSiteSettings();
  const channel = settings.twitch_channel;

  useEffect(() => {
    const checkLive = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("check-twitch-live");
        if (!error && data?.is_live) {
          setIsLive(true);
          setStream(data.stream);

          // Play a subtle notification chime once
          if (!hasPlayedSound.current) {
            hasPlayedSound.current = true;
            try {
              const ctx = new AudioContext();
              const now = ctx.currentTime;

              // Two-tone chime: a soft rising pair of notes
              const playTone = (freq: number, start: number, dur: number) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = "sine";
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0, now + start);
                gain.gain.linearRampToValueAtTime(0.08, now + start + 0.04);
                gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
                osc.connect(gain).connect(ctx.destination);
                osc.start(now + start);
                osc.stop(now + start + dur);
              };

              playTone(880, 0, 0.25);    // A5
              playTone(1174.66, 0.12, 0.3); // D6
            } catch {
              // AudioContext may not be allowed yet — that's fine
            }
          }
        } else {
          setIsLive(false);
        }
      } catch {
        // silently fail
      }
    };

    checkLive();
    const interval = setInterval(checkLive, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!isLive || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -80, opacity: 0 }}
        transition={{ type: "spring", damping: 18, stiffness: 260 }}
        className="fixed top-0 left-0 right-0 z-[100]"
      >
        <a
          href={`https://twitch.tv/${channel}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <div className="relative overflow-hidden bg-gradient-to-r from-[#9146FF] via-[#772CE8] to-[#9146FF] px-4 py-3">
            {/* Shimmer sweep */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent"
              initial={{ x: "-100%" }}
              animate={{ x: "200%" }}
              transition={{ duration: 1.8, delay: 0.4, ease: "easeInOut" }}
            />

            {/* Subtle pulse */}
            <motion.div
              className="absolute inset-0 bg-white/5"
              animate={{ opacity: [0, 0.12, 0] }}
              transition={{ duration: 2, repeat: 2, delay: 0.3 }}
            />

            <div className="relative flex items-center justify-center gap-3 text-center">
              {/* Live dot */}
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>

              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="text-sm md:text-base font-display font-semibold tracking-wide uppercase text-white"
              >
                REPLAY CLUB IS LIVE
              </motion.span>

              {stream?.title && (
                <motion.span
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5, duration: 0.4 }}
                  className="hidden md:inline text-sm text-white/80 font-body truncate max-w-[300px]"
                >
                  — {stream.title}
                </motion.span>
              )}

              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7, duration: 0.4 }}
                className="text-xs text-white/90 font-body underline underline-offset-2"
              >
                Watch Now →
              </motion.span>
            </div>

            {/* Close button */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDismissed(true);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </a>
      </motion.div>
    </AnimatePresence>
  );
};

export default TwitchLiveBanner;
