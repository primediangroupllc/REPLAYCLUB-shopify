import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Headphones, Music, Speaker, Monitor, Cable, Check, Ban, Eye, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export const equipment = [
  {
    name: "AlphaTheta XDJ-AZ",
    category: "DJ Gear",
    price: "$125 / day",
    priceCents: 12500,
    icon: Music,
    description: "Professional all-in-one DJ system with dual decks and mixer.",
  },
  {
    name: "Prophet 8",
    category: "Synths",
    price: "$200 / day",
    priceCents: 20000,
    icon: Music,
    description: "8-voice analog polyphonic synthesizer by Sequential.",
  },
  {
    name: "Sony FX3 Cinema Camera",
    category: "Cameras",
    price: "$130 / day",
    priceCents: 13000,
    icon: Monitor,
    description: "Full-frame cinema line camera for professional video production.",
  },
  {
    name: "Sony C-800G Tube Mic",
    category: "Microphones",
    price: "$150 / day",
    priceCents: 15000,
    icon: Mic,
    description: "Legendary studio tube condenser microphone.",
  },
  {
    name: "Shure SM7B",
    category: "Microphones",
    price: "$25 / day",
    priceCents: 2500,
    icon: Mic,
    description: "Dynamic cardioid mic, perfect for vocals and podcasts.",
  },
  {
    name: "Neumann U87 Ai",
    category: "Microphones",
    price: "$75 / day",
    priceCents: 7500,
    icon: Mic,
    description: "Industry-standard large-diaphragm condenser microphone.",
  },
  {
    name: "Rodecaster Pro II Console",
    category: "Interfaces",
    price: "$40 / day",
    priceCents: 4000,
    icon: Cable,
    description: "All-in-one podcast production console with multitrack recording.",
  },
  {
    name: "Sennheiser HD 650",
    category: "Headphones",
    price: "$20 / day",
    priceCents: 2000,
    icon: Headphones,
    description: "Open-back reference headphones for critical listening.",
  },
];

interface EquipmentSectionProps {
  onBookSelected?: (selectedItems: string[]) => void;
  selectedItems: Set<string>;
  onToggleItem: (name: string) => void;
}

const EquipmentSection = ({ onBookSelected, selectedItems, onToggleItem }: EquipmentSectionProps) => {
  const [activeCategory, setActiveCategory] = useState("All");
  const [unavailable, setUnavailable] = useState<Map<string, string>>(new Map());
  const [contention, setContention] = useState<Map<string, number>>(new Map());
  // Admin-managed bookable items merged in alongside the hardcoded base catalog.
  const [customItems, setCustomItems] = useState<typeof equipment>([]);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("custom_equipment_items")
      .select("name,description,category,price_cents,price_label,sort_order,image_url,bookable")
      .eq("bookable", true)
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        if (cancelled || !data) return;
        setCustomItems(
          data.map((c: any) => ({
            name: c.name,
            category: c.category || "Other",
            price: c.price_label || (c.price_cents ? `$${(c.price_cents / 100).toFixed(0)} / day` : "—"),
            priceCents: c.price_cents || 0,
            icon: Package,
            description: c.description || "",
          }))
        );
      });
    return () => { cancelled = true; };
  }, []);

  // Merge hardcoded base catalog with admin-managed DB items.
  // Dedupe by case-insensitive name, preferring DB rows so admin edits win.
  // This prevents duplicate cards now that the foundation seed loaded the
  // canonical catalog into custom_equipment_items.
  const allEquipment = useMemo(() => {
    const seen = new Map<string, (typeof equipment)[number]>();
    for (const item of customItems) {
      seen.set(item.name.trim().toLowerCase(), item);
    }
    for (const item of equipment) {
      const key = item.name.trim().toLowerCase();
      if (!seen.has(key)) seen.set(key, item);
    }
    return Array.from(seen.values());
  }, [customItems]);
  const categories = useMemo(
    () => ["All", ...Array.from(new Set(allEquipment.map((e) => e.category)))],
    [allEquipment]
  );

  useEffect(() => {
    const fetchAvailability = async () => {
      const { data } = await supabase.rpc("get_unavailable_equipment");
      if (data) {
        const map = new Map<string, string>();
        data.forEach((row: { equipment_name: string; available_after: string }) => {
          map.set(row.equipment_name, row.available_after);
        });
        setUnavailable(map);
      }
    };
    fetchAvailability();

    const fetchContention = async () => {
      const { data } = await supabase.rpc("get_active_equipment_locks");
      if (data) {
        const map = new Map<string, number>();
        (data as Array<{ equipment_name: string }>).forEach((row) => {
          map.set(row.equipment_name, (map.get(row.equipment_name) || 0) + 1);
        });
        setContention(map);
      }
    };
    fetchContention();
    const t = setInterval(fetchContention, 20_000);
    return () => clearInterval(t);
  }, []);

  const filtered =
    activeCategory === "All"
      ? allEquipment
      : allEquipment.filter((e) => e.category === activeCategory);

  return (
    <section id="equipment" className="py-28 px-6 relative">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-center mb-16"
        >
          <p className="text-muted-foreground font-body text-[11px] uppercase tracking-[0.3em] mb-4">
            Gear Rental
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-bold chrome-text">
            EQUIPMENT
          </h2>
        </motion.div>

        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-[11px] font-body uppercase tracking-[0.15em] border transition-all ${
                activeCategory === cat
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border/40 text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Equipment Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filtered.map((item, i) => {
            const Icon = item.icon;
            const isSelected = selectedItems.has(item.name);
            const unavailableUntil = unavailable.get(item.name);
            const isUnavailable = !!unavailableUntil;
            const viewers = contention.get(item.name) || 0;
            const otherViewers = isSelected ? Math.max(viewers - 1, 0) : viewers;
            return (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                onClick={() => !isUnavailable && onToggleItem(item.name)}
                className={`group relative rounded-lg border bg-card/50 backdrop-blur-sm p-5 transition-all duration-300 ${
                  isUnavailable
                    ? "border-border/20 opacity-60 cursor-not-allowed"
                    : isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30 cursor-pointer"
                      : "border-border/30 hover:border-primary/40 hover:bg-card/80 cursor-pointer"
                }`}
              >
                {/* Unavailable overlay on hover */}
                {isUnavailable && (
                  <div className="absolute inset-0 rounded-lg bg-background/80 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center z-10">
                    <Ban className="w-5 h-5 text-destructive mb-1.5" />
                    <span className="font-display text-[11px] font-semibold text-destructive uppercase tracking-wider">Unavailable</span>
                    <span className="font-body text-[10px] text-muted-foreground mt-0.5">
                      until {format(new Date(unavailableUntil + "T00:00:00"), "MMM d, yyyy")}
                    </span>
                  </div>
                )}

                {/* Selected checkmark */}
                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                    >
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Live contention indicator */}
                {!isUnavailable && otherViewers > 0 && (
                  <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 backdrop-blur-sm">
                    <Eye className="w-2.5 h-2.5 text-amber-400" />
                    <span className="text-[9px] font-display font-semibold text-amber-300 uppercase tracking-wider">
                      {otherViewers} viewing
                    </span>
                  </div>
                )}

                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2 rounded-md transition-colors ${
                    isSelected
                      ? "bg-primary/10 text-primary"
                      : "bg-primary/5 text-primary/70 group-hover:text-primary"
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="text-right">
                    <span className={`font-display text-sm font-bold chrome-text transition-opacity duration-200 ${
                      isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    }`}>
                      {item.price}
                    </span>
                  </div>
                </div>
                <h3 className="font-display text-sm font-semibold text-foreground mb-1">
                  {item.name}
                </h3>
                <p className="text-muted-foreground text-xs font-body leading-relaxed">
                  {item.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default EquipmentSection;
