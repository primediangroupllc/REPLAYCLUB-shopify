import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import shopUsb from "@/assets/shop-box-preview.webp";

const Shop = () => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Floating blurred USB background */}
      <motion.div
        initial={{ opacity: 0, scale: 1.05 }}
        animate={{ opacity: 0.55, scale: 1, y: [0, -14, 0] }}
        transition={{
          opacity: { duration: 1.4, ease: "easeOut" },
          scale: { duration: 1.4, ease: "easeOut" },
          y: { duration: 7, repeat: Infinity, ease: "easeInOut" },
        }}
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        aria-hidden="true"
      >
        <img
          src={shopUsb}
          alt=""
          className="w-[120%] max-w-[1100px] object-contain blur-[7px] saturate-75 opacity-90 select-none"
          draggable={false}
        />
      </motion.div>

      {/* Vignette + grain overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_50%,transparent_0%,hsl(var(--background)/0.4)_55%,hsl(var(--background))_95%)]"
      />

      {/* Center content */}
      <main className="relative z-10 flex flex-col items-center justify-center text-center px-6 pt-16 pb-24 min-h-[calc(100vh-72px)]">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="max-w-xl flex flex-col items-center gap-5"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 backdrop-blur-md">
            <Lock className="w-3 h-3 text-primary" />
            <span className="text-[10px] font-display uppercase tracking-[0.25em] text-primary">
              Locked
            </span>
          </div>

          <h1 className="font-display text-4xl sm:text-6xl font-bold uppercase tracking-tight chrome-text">
            Coming Soon
          </h1>

          <p className="font-body text-sm sm:text-base text-muted-foreground leading-relaxed max-w-md">
            Replay Club merch, limited drops, and signature collectibles.
            Members will be the first to unlock the vault.
          </p>

          <div className="mt-2 flex items-center gap-2 text-[10px] font-display uppercase tracking-[0.2em] text-muted-foreground/80">
            <span className="w-8 h-px bg-border/60" />
            Welcome to the Club
            <span className="w-8 h-px bg-border/60" />
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default Shop;
