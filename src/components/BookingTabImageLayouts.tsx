import { useState } from "react";
import ImageLightbox from "@/components/ImageLightbox";
import { buildSrcSet, type BookingTabImage } from "@/lib/bookingTabImages";
import { cn } from "@/lib/utils";

interface LayoutProps {
  images: BookingTabImage[];
  alt: string;
  /** Optional override for the hero image style (e.g. object-position). */
  heroStyle?: React.CSSProperties;
}

function Tile({
  image,
  alt,
  className,
  sizes,
  priority,
  onClick,
  overlay,
  style,
}: {
  image: BookingTabImage;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  onClick: () => void;
  overlay?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const srcSet = buildSrcSet(image.url);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden cursor-zoom-in border-0 p-0 m-0 bg-transparent",
        className,
      )}
      aria-label={`Open ${alt}`}
    >
      <img
        src={image.url}
        srcSet={srcSet ?? undefined}
        sizes={sizes ?? "100vw"}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        // @ts-ignore
        fetchpriority={priority ? "high" : "auto"}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        style={style}
      />
      {overlay}
    </button>
  );
}

function useLightbox(images: BookingTabImage[], alt: string) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(0);
  const openAt = (i: number) => {
    setStart(i);
    setOpen(true);
  };
  const node = (
    <ImageLightbox
      images={images.map((img) => ({ url: img.url, alt }))}
      startIndex={start}
      open={open}
      onClose={() => setOpen(false)}
    />
  );
  return { openAt, node };
}

export function SingleLayout({ images, alt, heroStyle }: LayoutProps) {
  const { openAt, node } = useLightbox(images, alt);
  if (images.length === 0) return null;
  return (
    <>
      <div className="relative w-full h-[70vh] min-h-[460px] overflow-hidden">
        <Tile
          image={images[0]}
          alt={alt}
          className="absolute inset-0 w-full h-full"
          sizes="100vw"
          priority
          onClick={() => openAt(0)}
          style={heroStyle}
        />
      </div>
      {node}
    </>
  );
}

export function GalleryLayout({ images, alt, heroStyle }: LayoutProps) {
  const { openAt, node } = useLightbox(images, alt);
  if (images.length === 0) return null;
  return (
    <>
      <div className="relative w-full h-[60vh] min-h-[400px] overflow-hidden">
        <Tile
          image={images[0]}
          alt={alt}
          className="absolute inset-0 w-full h-full"
          sizes="100vw"
          priority
          onClick={() => openAt(0)}
          style={heroStyle}
        />
      </div>
      {images.length > 1 && (
        <div className="px-6 pt-6">
          <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {images.slice(1).map((img, i) => (
              <div
                key={img.id}
                className="relative aspect-[4/3] rounded-lg overflow-hidden border border-border/30"
              >
                <Tile
                  image={img}
                  alt={`${alt} ${i + 2}`}
                  className="absolute inset-0 w-full h-full"
                  sizes="(max-width: 640px) 50vw, 25vw"
                  onClick={() => openAt(i + 1)}
                />
              </div>
            ))}
          </div>
        </div>
      )}
      {node}
    </>
  );
}

export function CollageLayout({ images, alt, heroStyle }: LayoutProps) {
  const { openAt, node } = useLightbox(images, alt);
  const n = images.length;
  if (n === 0) return null;

  // 1 image — same as Single
  if (n === 1) return <SingleLayout images={images} alt={alt} heroStyle={heroStyle} />;

  const baseTile = "relative overflow-hidden rounded-lg border border-border/30";

  // 2 images: side-by-side
  if (n === 2) {
    return (
      <>
        <div className="px-3 pt-3">
          <div className="grid grid-cols-2 gap-3 max-w-6xl mx-auto h-[70vh] min-h-[420px]">
            {images.map((img, i) => (
              <div key={img.id} className={baseTile}>
                <Tile
                  image={img}
                  alt={`${alt} ${i + 1}`}
                  className="absolute inset-0 w-full h-full"
                  sizes="50vw"
                  priority={i === 0}
                  onClick={() => openAt(i)}
                />
              </div>
            ))}
          </div>
        </div>
        {node}
      </>
    );
  }

  // 3 images: 1 large left, 2 stacked right
  if (n === 3) {
    return (
      <>
        <div className="px-3 pt-3">
          <div className="grid grid-cols-2 gap-3 max-w-6xl mx-auto h-[70vh] min-h-[420px]">
            <div className={baseTile}>
              <Tile
                image={images[0]}
                alt={`${alt} 1`}
                className="absolute inset-0 w-full h-full"
                sizes="50vw"
                priority
                onClick={() => openAt(0)}
              />
            </div>
            <div className="grid grid-rows-2 gap-3">
              {[1, 2].map((i) => (
                <div key={images[i].id} className={baseTile}>
                  <Tile
                    image={images[i]}
                    alt={`${alt} ${i + 1}`}
                    className="absolute inset-0 w-full h-full"
                    sizes="50vw"
                    onClick={() => openAt(i)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
        {node}
      </>
    );
  }

  // 4 images: 2x2
  if (n === 4) {
    return (
      <>
        <div className="px-3 pt-3">
          <div className="grid grid-cols-2 gap-3 max-w-6xl mx-auto">
            {images.map((img, i) => (
              <div key={img.id} className={cn(baseTile, "aspect-[4/3]")}>
                <Tile
                  image={img}
                  alt={`${alt} ${i + 1}`}
                  className="absolute inset-0 w-full h-full"
                  sizes="50vw"
                  priority={i === 0}
                  onClick={() => openAt(i)}
                />
              </div>
            ))}
          </div>
        </div>
        {node}
      </>
    );
  }

  // 5+ images: 1 large hero + grid of remaining (cap visible at 6 total)
  // Visible: hero (idx 0) + up to 5 thumbs (idx 1..5). The 6th visible thumb
  // (idx 5) shows a "+N more" overlay when there are 7+ images, opening the
  // lightbox at image #7 (idx 6).
  const visibleThumbs = images.slice(1, 6); // up to 5
  const remaining = Math.max(0, n - 6);
  return (
    <>
      <div className="px-3 pt-3 space-y-3">
        <div className={cn(baseTile, "max-w-6xl mx-auto h-[55vh] min-h-[360px]")}>
          <Tile
            image={images[0]}
            alt={`${alt} 1`}
            className="absolute inset-0 w-full h-full"
            sizes="100vw"
            priority
            onClick={() => openAt(0)}
            style={heroStyle}
          />
        </div>
        <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {visibleThumbs.map((img, i) => {
            const isLast = i === visibleThumbs.length - 1;
            const showMore = isLast && remaining > 0;
            return (
              <div key={img.id} className={cn(baseTile, "aspect-[4/3]")}>
                <Tile
                  image={img}
                  alt={`${alt} ${i + 2}`}
                  className="absolute inset-0 w-full h-full"
                  sizes="(max-width: 640px) 50vw, 20vw"
                  onClick={() => openAt(showMore ? 6 : i + 1)}
                  overlay={
                    showMore ? (
                      <div className="absolute inset-0 bg-black/65 flex items-center justify-center text-foreground font-display text-lg sm:text-xl font-bold pointer-events-none">
                        +{remaining} more
                      </div>
                    ) : null
                  }
                />
              </div>
            );
          })}
        </div>
      </div>
      {node}
    </>
  );
}

export function BookingTabImagesRenderer({
  variant,
  images,
  alt,
  heroStyle,
}: LayoutProps & { variant: "single" | "gallery" | "collage" }) {
  if (variant === "single") return <SingleLayout images={images} alt={alt} heroStyle={heroStyle} />;
  if (variant === "collage") return <CollageLayout images={images} alt={alt} heroStyle={heroStyle} />;
  return <GalleryLayout images={images} alt={alt} heroStyle={heroStyle} />;
}