import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ROOM_LIVESTREAM, ROOM_EQUIPMENT_RENTAL } from "@/lib/bookingConstants";
import { useRequiredEquipment } from "@/hooks/useServiceEquipmentRequirements";


const serviceSlugMap: Record<string, string> = {
  "Disk Jockey": "/dj-studio",
  "Podcast": "/podcast-studio",
  [ROOM_LIVESTREAM]: "/livestream-studio",
  [ROOM_EQUIPMENT_RENTAL]: "/equipment-rental",
};

interface RoomCardProps {
  title: string;
  subtitle: string;
  image: string;
  price: string;
  features: string[];
  tiers?: string[];
  minimum?: string;
  popular?: boolean;
  available: boolean;
  imageStyle?: React.CSSProperties;
  galleryImages?: string[];
  onBook: () => void;
}

const RoomCard = ({ title, subtitle, image, price, features, tiers, minimum, popular, available, imageStyle, galleryImages, onBook }: RoomCardProps) => {
  const includedEquipment = useRequiredEquipment(title);
  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.015 }}
      transition={{ duration: 0.2 }}
      className="card-premium card-shine card-glow rounded-lg overflow-hidden group cursor-pointer relative transition-all duration-300"
      onClick={onBook}
    >
      <div className="relative h-52 overflow-hidden">
        <img
          src={image}
          alt={title}
          width={800}
          height={416}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover brightness-115 saturate-110 contrast-105 group-hover:brightness-125 group-hover:saturate-125 group-hover:scale-105 transition-all duration-500"
          style={{ objectPosition: 'center 60%', ...imageStyle }}
        />
        {/* Subtle bottom fade so the title section reads cleanly against
            the image. Light enough that the image still pops at full
            opacity. */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card to-transparent pointer-events-none" />
        {/* Chrome top hairline — reinforces the premium look. */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-chrome via-50% to-transparent opacity-70 pointer-events-none" />
        {available && (
          <span className="absolute top-4 right-4 bg-success/90 text-foreground text-[10px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1.5 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 bg-foreground rounded-full animate-pulse" />
            Available
          </span>
        )}
        {popular && (
          <span className="absolute top-4 left-4 bg-accent text-accent-foreground text-[10px] font-display font-semibold uppercase tracking-wider px-3 py-1 rounded-full backdrop-blur-sm">
            Most Popular
          </span>
        )}
      </div>
      {/* Gallery strip */}
      {galleryImages && galleryImages.length > 0 && (
        <div className="grid grid-cols-2 gap-px bg-border/20">
          {galleryImages.map((img, i) => (
            <div key={i} className="relative h-32 overflow-hidden">
              <img
                src={img}
                alt={`${title} gallery ${i + 1}`}
                width={400}
                height={256}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover brightness-115 saturate-110 contrast-105 group-hover:brightness-125 group-hover:saturate-125 transition-all duration-500"
                style={{ objectPosition: 'center 50%' }}
              />
            </div>
          ))}
        </div>
      )}
      <div className="p-6">
        <p className="text-muted-foreground text-[11px] font-body uppercase tracking-[0.2em] mb-2">{subtitle}</p>
        <h3 className="font-display text-xl font-bold chrome-text mb-0.5">{title}</h3>
        {title !== ROOM_LIVESTREAM && title !== ROOM_EQUIPMENT_RENTAL && (
          <p className="text-[10px] font-body text-muted-foreground uppercase tracking-[0.1em] mb-3">
            ​
          </p>
        )}
        {price && <p className="text-chrome font-display font-semibold text-sm mb-4">{price}</p>}

        {/* "What's included" — surfaces the dependency map (#5). */}
        {includedEquipment.length > 0 && (
          <p className="text-[10px] font-body text-primary/80 uppercase tracking-[0.15em] mb-3">
            Includes {includedEquipment.join(" + ")}
          </p>
        )}

        {/* Pricing Tiers */}
        {tiers && tiers.length > 0 && (
          <div className="mb-4 space-y-1.5">
            {tiers.map((tier) => (
              <p key={tier} className="text-[11px] font-body text-muted-foreground">
                {tier}
              </p>
            ))}
          </div>
        )}


        <ul className="space-y-2 mb-6">
          {features.map((f) => {
            const dayMatch = f.match(/\$(\d+)\/day/);
            const hourlyRate = dayMatch ? `$${Math.round(Number(dayMatch[1]) / 8)}/hr` : null;
            return (
              <li key={f} className="text-muted-foreground text-xs font-body flex items-center gap-2 relative group/item">
                <span className="w-px h-3 bg-chrome-dark" />
                <span>{f}</span>
                {hourlyRate && (
                  <span className="ml-auto text-[10px] font-display text-primary opacity-0 group-hover/item:opacity-100 transition-opacity duration-200">
                    ~{hourlyRate}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onBook();
          }}
          className="w-full chrome-btn-outline font-display font-semibold text-xs uppercase tracking-[0.15em] py-3 rounded-md transition-all duration-200"
        >
          {title === "Livestream" ? "Inquire" : "book"}
        </button>
        {/* Trust micro-line — surfaces refund policy + secure-checkout near the CTA
            to reduce hesitation on paid-ad traffic. */}
        <p className="mt-2 text-center text-[9px] font-body uppercase tracking-[0.18em] text-muted-foreground/80">
          Secure checkout · Free cancel 24h+
        </p>
        {serviceSlugMap[title] && (
          <Link
            to={serviceSlugMap[title]}
            onClick={(e) => e.stopPropagation()}
            className="block w-full text-center text-[10px] font-body text-muted-foreground hover:text-foreground mt-2 py-1 transition-colors"
          >
            Learn more →
          </Link>
        )}
      </div>
    </motion.div>
  );
};

export default RoomCard;