import { Calendar, Mail } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

interface Props {
  onBookClick: () => void;
  /** Hide bar when booking modal / selectors are open. */
  hidden?: boolean;
}

/**
 * Sticky mobile-only bottom CTA. Appears after the user scrolls past the hero
 * to keep "Book Now" one thumb-tap away on long pages — the single biggest
 * mobile conversion lever for paid-ad traffic.
 */
const StickyMobileCTA = ({ onBookClick, hidden }: Props) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      // Show after the user has scrolled roughly past the hero (~70vh).
      setVisible(window.scrollY > window.innerHeight * 0.6);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && !hidden && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          className="md:hidden fixed bottom-0 inset-x-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 bg-gradient-to-t from-background via-background/95 to-transparent"
        >
          <div className="flex items-center gap-2 chrome-surface border border-border/60 rounded-full p-1.5 shadow-[0_8px_30px_hsl(0_0%_0%/0.6)] backdrop-blur-xl">
            <a
              href="mailto:replayclubrecords@gmail.com"
              aria-label="Email Replay Club"
              className="flex items-center justify-center w-10 h-10 rounded-full border border-border/50 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Mail className="w-4 h-4" />
            </a>
            <button
              onClick={onBookClick}
              className="flex-1 chrome-btn font-display font-semibold text-xs uppercase tracking-[0.2em] px-4 py-2.5 rounded-full inline-flex items-center justify-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              Book Now
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StickyMobileCTA;