import { useState, useRef, useEffect, ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface OptimizedImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  /** Use "eager" for above-the-fold hero/LCP images, defaults to "lazy" */
  priority?: boolean;
  /** Responsive sizes attribute (e.g. "(max-width: 768px) 100vw, 50vw") */
  sizes?: string;
  /** Widths to generate in srcset. Defaults to [480, 768, 1200, 1920]. */
  widths?: number[];
}

const DEFAULT_WIDTHS = [480, 768, 1200, 1920];

/**
 * Builds Supabase Storage transform URLs (?width=&quality=&format=webp).
 * Returns null for non-Supabase URLs (bundler imports, external images) so
 * we fall back to the original `src` without a srcset.
 */
function buildSupabaseSrcSet(src: string, widths: number[]): string | null {
  try {
    const url = new URL(src, window.location.origin);
    if (!url.pathname.includes("/storage/v1/object/public/")) return null;
    // Switch to render endpoint which supports transformations
    const renderPath = url.pathname.replace(
      "/storage/v1/object/public/",
      "/storage/v1/render/image/public/",
    );
    return widths
      .map((w) => {
        const u = new URL(renderPath, url.origin);
        u.searchParams.set("width", String(w));
        u.searchParams.set("quality", "75");
        return `${u.toString()} ${w}w`;
      })
      .join(", ");
  } catch {
    return null;
  }
}

const OptimizedImage = ({
  priority = false,
  className,
  alt = "",
  onLoad,
  sizes,
  widths = DEFAULT_WIDTHS,
  src,
  ...props
}: OptimizedImageProps) => {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (imgRef.current?.complete) setLoaded(true);
  }, []);

  const srcSet =
    typeof src === "string" ? buildSupabaseSrcSet(src, widths) : null;

  return (
    <img
      ref={imgRef}
      src={src}
      srcSet={srcSet ?? undefined}
      sizes={srcSet ? sizes ?? "100vw" : undefined}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      // @ts-ignore — fetchPriority is valid HTML but not yet in React types
      fetchpriority={priority ? "high" : "auto"}
      onLoad={(e) => {
        setLoaded(true);
        onLoad?.(e);
      }}
      className={cn(
        "transition-opacity duration-500",
        loaded ? "opacity-100" : "opacity-0",
        className
      )}
      {...props}
    />
  );
};

export default OptimizedImage;
