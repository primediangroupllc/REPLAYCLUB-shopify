import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import OptimizedImage from "@/components/OptimizedImage";

interface ServiceItem {
  title: string;
  subtitle: string;
  image: string;
  price: string;
  imageStyle?: React.CSSProperties;
  [key: string]: any;
}

interface ServiceSelectorProps {
  open: boolean;
  onClose: () => void;
  services: ServiceItem[];
  onSelect: (service: ServiceItem) => void;
}

const ServiceSelector = ({ open, onClose, services, onSelect }: ServiceSelectorProps) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-y-auto"
          style={{ background: "radial-gradient(ellipse at center, hsl(0 0% 6%) 0%, hsl(0 0% 2%) 60%, hsl(0 0% 0%) 100%)" }}
        >
          {/* Close button */}
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            onClick={onClose}
            className="absolute top-6 right-6 text-muted-foreground hover:text-foreground transition-colors z-10"
          >
            <X className="w-6 h-6" />
          </motion.button>

          {/* Title */}
          <motion.h2
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="font-display text-2xl md:text-3xl font-bold chrome-text mb-2 text-center"
          >
            Choose Your Session
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.5 }}
            className="text-muted-foreground text-xs font-body uppercase tracking-[0.2em] mb-10"
          >
            Select a service to get started
          </motion.p>

          {/* Grid — siblings dim when one card is hovered (see
              .service-selector-grid rule in index.css) */}
          <div className="service-selector-grid grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 px-6 max-w-4xl w-full">
            {services.filter(s => !(s as any).comingSoon).map((service, i) => (
              <motion.button
                key={service.title}
                initial={{ opacity: 0, y: 40, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.2 + i * 0.08, duration: 0.5, type: "spring", stiffness: 200, damping: 20 }}
                whileHover={{ scale: 1.06, y: -8 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onSelect(service)}
                className="group relative rounded-xl overflow-hidden cursor-pointer aspect-[3/4] md:aspect-[4/5]"
              >
                {/* Image — full opacity at rest with brightness/saturation
                    boost to match the chrome aesthetic. Was opacity-40 +
                    opacity-70-on-hover (heavily dimmed); now full bright
                    so cards visibly pop the moment the selector opens. */}
                <OptimizedImage
                  src={service.image}
                  alt={service.title}
                  className="absolute inset-0 w-full h-full object-cover brightness-110 saturate-110 contrast-105 group-hover:brightness-125 group-hover:saturate-125 group-hover:scale-110 transition-all duration-700"
                  style={{ objectPosition: "center 60%", ...service.imageStyle }}
                />

                {/* Center vignette — title now sits in the middle of the
                    card, so the dark backing needs to be centered too.
                    A soft radial darkening keeps the photo bright at the
                    edges while making the title pin-sharp. */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "radial-gradient(ellipse at center, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 50%, transparent 80%)",
                  }}
                />

                {/* Chrome glow border on hover */}
                <div className="absolute inset-0 rounded-xl border border-transparent group-hover:border-[hsl(0_0%_70%_/_0.3)] transition-all duration-500" />
                <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{
                    boxShadow: "inset 0 1px 0 0 hsl(0 0% 100% / 0.1), 0 0 30px -5px hsl(0 0% 80% / 0.15), 0 0 60px -10px hsl(0 0% 70% / 0.08)"
                  }}
                />

                {/* Content — bright white text with filter drop-shadow
                    (works through chrome-text's background-clip, which
                    text-shadow does not). Title keeps chrome aesthetic
                    via chrome-text + larger size; supporting text is
                    pure white for maximum contrast on the photo. */}
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center p-4"
                  style={{
                    filter:
                      "drop-shadow(0 1px 3px rgba(0,0,0,0.95)) drop-shadow(0 3px 10px rgba(0,0,0,0.7))",
                  }}
                >
                  <h3 className="font-display text-lg md:text-xl font-bold chrome-text transition-all duration-500">
                    {service.title}
                  </h3>

                  {/* Always-visible chrome accent line — thinner at rest,
                      widens on hover. Reinforces the chrome aesthetic
                      without needing a hover trigger to be present. */}
                  <motion.div
                    className="w-10 group-hover:w-20 h-px mt-3 transition-all duration-500 ease-out"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent, hsl(0 0% 92%), transparent)",
                    }}
                  />
                </div>
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ServiceSelector;
