import { useState } from "react";
import { Play } from "lucide-react";

interface Props {
  videoId: string;
  title?: string;
}

/**
 * Lightweight YouTube embed.
 *
 * Renders YouTube's own thumbnail (`maxresdefault.jpg`, falling back to
 * `hqdefault.jpg`) with a play-button overlay. The actual iframe is mounted
 * only after the user clicks, with `autoplay=1` so the video plays
 * immediately. This guarantees a visible preview (the bare embed often shows
 * a black box until interaction) and eliminates the ~500 KB+ initial JS that
 * the YouTube embed loads.
 */
const YouTubeFacade = ({ videoId, title }: Props) => {
  const [active, setActive] = useState(false);
  const [thumbSrc, setThumbSrc] = useState(
    `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
  );

  return (
    <div
      className="relative w-full rounded-lg overflow-hidden border border-border/50 bg-black"
      style={{ paddingBottom: "56.25%" }}
    >
      {active ? (
        <iframe
          key={videoId}
          className="absolute inset-0 w-full h-full"
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
          title={title ?? "YouTube video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setActive(true)}
          aria-label={title ? `Play ${title}` : "Play video"}
          className="absolute inset-0 group cursor-pointer"
        >
          <img
            src={thumbSrc}
            alt={title ?? "Video preview"}
            loading="lazy"
            decoding="async"
            onError={() => {
              if (thumbSrc.includes("maxresdefault")) {
                setThumbSrc(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`);
              }
            }}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
          <span className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-black/70 backdrop-blur-sm border border-white/20 shadow-2xl group-hover:bg-primary group-hover:scale-110 transition-all duration-300">
              <Play className="w-7 h-7 sm:w-8 sm:h-8 text-white fill-white translate-x-0.5" />
            </span>
          </span>
        </button>
      )}
    </div>
  );
};

export default YouTubeFacade;