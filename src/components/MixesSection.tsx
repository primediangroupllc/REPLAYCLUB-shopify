import { motion } from "framer-motion";
import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { track } from "@/lib/analytics";
import WaveformGlyph from "@/components/WaveformGlyph";
import mixPlaceholder from "@/assets/mix-placeholder.jpg";

// Supporting line — swappable. Recommended: A (calm, premium, on-brand).
//   A: "Listen back, closer."   B: "See what happened."   C: "See the set differently."
const SUPPORT_LINE = "Listen back, closer.";

interface MixesSectionProps {
  isLoggedIn: boolean;
  youtubeHandle?: string;
}

/**
 * Homepage "Deck" — the Mixes pitch beside one real example artifact.
 *
 * Bottom of the EXPERIENCE-SPEC pronoun ladder: it talks about "the set",
 * never "you". No scores, no identity, no DNA, no reputation, no tracklist
 * (Stage B). The card is a STATIC PRODUCT MOCKUP — no real mix, user, or
 * analysis data, no audio, no DB query.
 */
// Static decorative waveform for the homepage product mockup (not real audio).
const MOCKUP_WAVEFORM = [
  0.32, 0.5, 0.68, 0.55, 0.8, 0.62, 0.9, 0.72, 0.84, 0.6, 0.74, 0.52, 0.66,
  0.86, 0.7, 0.92, 0.76, 0.6, 0.82, 0.7, 0.56, 0.72, 0.86, 0.64, 0.78, 0.9,
  0.7, 0.6, 0.8, 0.7, 0.86, 0.6, 0.7, 0.76, 0.54, 0.66, 0.82, 0.7, 0.9, 0.64,
  0.76, 0.6, 0.7, 0.86, 0.7, 0.55, 0.8, 0.66, 0.76, 0.7, 0.6, 0.85, 0.7, 0.5,
  0.66, 0.74,
];
export default function MixesSection({ isLoggedIn, youtubeHandle }: MixesSectionProps) {
  const navigate = useNavigate();
  const deckViewTracked = useRef(false);
  const uploadTarget = "/profile?tab=mixes&upload=1";
  const goUpload = () => {
    track("upload_mix_click", { logged_in: isLoggedIn });
    navigate(isLoggedIn ? uploadTarget : `/auth?next=${encodeURIComponent(uploadTarget)}`);
  };

  return (
    <section id="mixes" className="py-16 px-4 border-t border-border">
      <div className="max-w-5xl mx-auto grid md:grid-cols-[1fr_1.1fr] gap-8 md:gap-12 items-center">
        {/* Pitch */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          onViewportEnter={() => {
            // Funnel: deck actually scrolled into view (not just page-loaded).
            // Ref guards StrictMode's dev double-invoke.
            if (deckViewTracked.current) return;
            deckViewTracked.current = true;
            track("deck_view");
          }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="space-y-5"
        >
          <p className="text-caption chrome-text uppercase !tracking-[0.3em]">Mixes</p>
          <div className="space-y-2">
            <h2 className="text-h2 font-display text-foreground">Keep every set. Play it back.</h2>
            <p className="font-body text-muted-foreground">{SUPPORT_LINE}</p>
          </div>
          <ul className="space-y-1.5 text-sm font-body text-muted-foreground">
            <li>Your sets, kept and streamable.</li>
            <li>Upload, listen back, and share when ready.</li>
          </ul>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pt-1">
            <button
              onClick={goUpload}
              className="chrome-btn font-display font-semibold text-sm uppercase tracking-[0.15em] px-8 py-3.5 rounded-md"
            >
              Upload a Mix
            </button>
            {youtubeHandle && (
              <a
                href={`https://www.youtube.com/${youtubeHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-display uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground transition-colors"
              >
                Subscribe on YouTube ↗
              </a>
            )}
          </div>
        </motion.div>

        {/* Static product mockup — no real mix / user / analysis data */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          whileHover={{ y: -6 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="card-premium card-shine card-glow rounded-xl p-4 sm:p-5 space-y-4"
        >
          <div className="flex items-center gap-3">
            <img
              src={mixPlaceholder}
              alt=""
              aria-hidden="true"
              className="w-12 h-12 rounded-md object-cover border border-border/60 brightness-110 saturate-105"
            />
            <div className="min-w-0">
              <p className="font-display text-sm font-semibold text-foreground uppercase tracking-wider truncate">
                REPLAY CLUB MIX
              </p>
              <p className="text-[11px] text-muted-foreground font-body">
                Upload. Store. Listen back.
              </p>
            </div>
          </div>

          <WaveformGlyph peaks={MOCKUP_WAVEFORM} className="w-full h-14" />
        </motion.div>
      </div>
    </section>
  );
}
