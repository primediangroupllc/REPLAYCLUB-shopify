import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { buildSrcSet } from "@/lib/bookingTabImages";
import { cn } from "@/lib/utils";

export interface LightboxImage {
  url: string;
  alt?: string;
}

interface Props {
  images: LightboxImage[];
  startIndex?: number;
  open: boolean;
  onClose: () => void;
}

const ImageLightbox = ({ images, startIndex = 0, open, onClose }: Props) => {
  const [index, setIndex] = useState(startIndex);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (open) setIndex(startIndex);
  }, [open, startIndex]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setIndex((i) => (i + 1) % images.length);
      else if (e.key === "ArrowLeft")
        setIndex((i) => (i - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, images.length, onClose]);

  if (!open || images.length === 0) return null;

  const current = images[index];
  const srcSet = buildSrcSet(current.url);
  const multi = images.length > 1;

  const node = (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-sm"
      onClick={onClose}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchStartX.current == null || !multi) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(dx) > 40) {
          if (dx < 0) setIndex((i) => (i + 1) % images.length);
          else setIndex((i) => (i - 1 + images.length) % images.length);
        }
        touchStartX.current = null;
      }}
    >
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 rounded-full p-2 bg-background/40 hover:bg-background/70 text-foreground transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      {multi && (
        <>
          <button
            aria-label="Previous image"
            onClick={(e) => {
              e.stopPropagation();
              setIndex((i) => (i - 1 + images.length) % images.length);
            }}
            className="absolute left-2 sm:left-6 z-10 rounded-full p-2 bg-background/40 hover:bg-background/70 text-foreground"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            aria-label="Next image"
            onClick={(e) => {
              e.stopPropagation();
              setIndex((i) => (i + 1) % images.length);
            }}
            className="absolute right-2 sm:right-6 z-10 rounded-full p-2 bg-background/40 hover:bg-background/70 text-foreground"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-xs font-body text-foreground/80 px-3 py-1 rounded-full bg-background/40">
            {index + 1} / {images.length}
          </div>
        </>
      )}

      <img
        key={current.url}
        src={current.url}
        srcSet={srcSet ?? undefined}
        sizes="100vw"
        alt={current.alt ?? ""}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "max-w-[100vw] max-h-[100vh] sm:max-w-[92vw] sm:max-h-[92vh] object-contain",
        )}
        loading="eager"
        decoding="async"
      />
    </div>
  );

  return createPortal(node, document.body);
};

export default ImageLightbox;