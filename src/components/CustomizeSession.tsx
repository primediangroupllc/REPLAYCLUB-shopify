import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  rentalPriceMap,
  ROOM_LIVESTREAM,
  ROOM_EQUIPMENT_RENTAL,
  ROOM_STUDIO_SESH,
  ROOM_DJ_SESSION,
  ROOM_MUSIC,
} from "@/lib/bookingConstants";
import { useStudioConfig } from "@/hooks/useStudioConfig";
import { usePublicSiteSettings } from "@/hooks/useSiteSettings";

// Re-export from the single source of truth so existing imports keep working.
export { rentalPriceMap };

interface CustomizeSessionProps {
  room: {
    title: string;
    subtitle: string;
    image: string;
    price: string;
  };
  onBack: () => void;
  onContinue: (selections: SessionSelections) => void;
  isContinuing?: boolean;
}

export interface SessionSelections {
  equipment: string[];
  lighting: string;
  sound: string;
  layout: string;
}

const equipmentOptions: Record<string, string[]> = {
  "Studio Sesh": ["Sony C800", "TLM 103", "SHURE SM7B", "BACH 195 w/ Vintage U87 Capsule", "BLUE Condenser Mic", "SC Electronics V7 Mic", "Prophet 8", "Ableton Push", "Novation Launch Control", "JBL 305P MKii 5\"", "Cube Amp", "DT 990 Pro Headphones", "DT 770 Headphones", "ART & Lutherie Acoustic", "Lava Acoustic"],
  "Podcast": ["SC Electronics V7 Mic", "DJI Wireless Mic", "DT 990 Pro Headphones", "DT 770 Headphones"],
  "Disk Jockey": ["AlphaTheta XDJ-AZ", "Ableton Push", "Novation Launch Control", "JBL 305P MKii 5\"", "DT 990 Pro Headphones", "DT 770 Headphones", "LED Light Bar x2"],
  "Photoshoot": ["Sony FX3", "Canon 90D", "Phone Ring Light x2", "GVM PRO-SD300B", "LED Light Bar x2", "Prism FX Lenses x4", "Canon 70-200mm Lens", "Ronin RS3 Mini"],
  "Livestream": ["Sony FX3", "Canon 90D", "Sony 4K FDR-X3000", "Sony FX3 XLR Mic Attachment", "Rode Shotgun Mic", "DJI Wireless Mic", "Ronin RS3 Mini", "Prism FX Lenses x4", "Canon 70-200mm Lens", "GVM PRO-SD300B", "LED Light Bar x2"],
  "Equipment Rental": ["AlphaTheta XDJ-AZ", "Ableton Push", "Novation Launch Control", "JBL 305P MKii 5\"", "Sony FX3", "Canon 90D", "DJI Wireless Mic", "Sony 4K FDR-X3000", "SC Electronics V7 Mic", "Sony C800", "TLM 103", "SHURE SM7B", "BACH 195 w/ Vintage U87 Capsule", "BLUE Condenser Mic", "Prophet 8", "Cube Amp", "Phone Ring Light x2", "GVM PRO-SD300B", "LED Light Bar x2", "ART & Lutherie Acoustic", "Lava Acoustic", "DT 990 Pro Headphones", "DT 770 Headphones", "Ronin RS3 Mini", "Rode Shotgun Mic", "Sony FX3 XLR Mic Attachment", "Prism FX Lenses x4", "Canon 70-200mm Lens"],
};

interface DJBundle {
  id: string;
  name: string;
  desc: string;
  items: string[];
}

const djBundles: DJBundle[] = [
  {
    id: "essentials",
    name: "Essentials",
    desc: "Everything you need for a solid set",
    items: ["AlphaTheta XDJ-AZ", "DT 990 Pro Headphones"],
  },
  {
    id: "performance",
    name: "Performance",
    desc: "Full setup with dashcam, lighting & backdrop",
    items: ["AlphaTheta XDJ-AZ", "DT 990 Pro Headphones", "Sony 4K FDR-X3000", "Custom Lighting Setup", "Custom Background"],
  },
  {
    id: "showtime",
    name: "Showtime",
    desc: "The complete experience with pro recording & visuals",
    items: ["AlphaTheta XDJ-AZ", "DT 990 Pro Headphones", "Sony FX3", "Sony 4K FDR-X3000", "Custom Lighting Setup", "Custom Background", "JBL 305P MKii 5\"", "LED Light Bar x2"],
  },
];

const backgroundOptions = [
  { id: "black-abyss", label: "Black Abyss", desc: "Deep black void backdrop" },
  { id: "greenscreen", label: "Greenscreen", desc: "Chromakey for custom visuals" },
  { id: "office-white", label: "Office White", desc: "Clean minimal white backdrop" },
  { id: "wood-grid", label: "Wood Grid", desc: "Warm textured wood panel wall" },
];

export const lightingOptions = [
  { id: "ambient", label: "Ambient Warm", desc: "Soft warm tones for a cozy vibe" },
  { id: "studio", label: "Studio White", desc: "Clean bright professional lighting" },
  { id: "neon", label: "Neon RGB", desc: "Colorful LED strips & accent lights" },
  { id: "moody", label: "Moody Low", desc: "Dim atmospheric dark tones" },
];

const soundOptions = [
  { id: "monitors", label: "Studio Monitors", desc: "Flat-response reference speakers" },
  { id: "headphones", label: "Headphones Only", desc: "Closed-back monitoring" },
];

const layoutOptions = [
  { id: "classic", label: "Classic Studio", desc: "Traditional recording layout" },
  { id: "lounge", label: "Lounge Vibes", desc: "Relaxed couch & rug setup" },
  { id: "performance", label: "Performance", desc: "Open space for live sets" },
  { id: "interview", label: "Interview Set", desc: "Face-to-face seated arrangement" },
];

const inputClasses =
  "w-full bg-background border border-border rounded-md px-3 py-2.5 text-xs font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-chrome transition-all";

const CustomizeSession = ({ room, onBack, onContinue, isContinuing = false }: CustomizeSessionProps) => {
  const isDJ = room.title === ROOM_DJ_SESSION;
  const isMusic = room.title === ROOM_MUSIC;
  const { settings: siteSettings } = usePublicSiteSettings();
  // Map customer-facing room title → admin pause key.
  const pauseKey = (() => {
    switch (room.title) {
      case ROOM_MUSIC: return "music";
      case ROOM_DJ_SESSION: return "dj";
      case "Podcast": return "podcast";
      case ROOM_LIVESTREAM: return "livestream";
      case ROOM_EQUIPMENT_RENTAL: return "equipment";
      default: return null;
    }
  })();
  const isPaused = !!(pauseKey && siteSettings.booking_pauses[pauseKey]);
  const { config: musicConfig } = useStudioConfig(isMusic ? "music" : null);
  const [selectedBundle, setSelectedBundle] = useState<string>(isDJ ? "essentials" : "");
  const defaultEquipment = isDJ ? (djBundles.find(b => b.id === "essentials")?.items || []) : [];
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>(defaultEquipment);
  const [selectedLighting, setSelectedLighting] = useState("");
  const [selectedSound, setSelectedSound] = useState("");
  const [selectedLayout, setSelectedLayout] = useState("");
  const [selectedMusicAddons, setSelectedMusicAddons] = useState<string[]>([]);
  const [selectedBackground, setSelectedBackground] = useState("");

  // Inquiry form state
  const [inquiryName, setInquiryName] = useState("");
  const [inquiryEmail, setInquiryEmail] = useState("");
  const [inquiryPhone, setInquiryPhone] = useState("");
  const [inquiryMessage, setInquiryMessage] = useState("");

  const isLivestream = room.title === ROOM_LIVESTREAM;
  const isEquipmentRental = room.title === ROOM_EQUIPMENT_RENTAL;
  const equipment = equipmentOptions[room.title] || equipmentOptions[ROOM_STUDIO_SESH];

  const selectBundle = (bundleId: string) => {
    const bundle = djBundles.find(b => b.id === bundleId);
    if (bundle) {
      setSelectedBundle(bundleId);
      setSelectedEquipment(bundle.items);
    }
  };

  const toggleEquipment = (item: string) => {
    setSelectedEquipment((prev) =>
      prev.includes(item) ? prev.filter((e) => e !== item) : [...prev, item]
    );
  };

  const handleContinue = () => {
    onContinue({
      equipment: isMusic ? selectedMusicAddons : selectedEquipment,
      lighting: selectedLighting,
      sound: selectedSound,
      layout: selectedLayout,
    });
  };

  const toggleMusicAddon = (id: string) => {
    setSelectedMusicAddons((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleInquirySubmit = () => {
    if (!inquiryName.trim() || !inquiryEmail.trim() || !inquiryMessage.trim()) return;

    const subject = encodeURIComponent("Livestream Inquiry");
    const body = encodeURIComponent(
      `Name: ${inquiryName.trim()}\nEmail: ${inquiryEmail.trim()}\nPhone: ${inquiryPhone.trim()}\n\n${inquiryMessage.trim()}`
    );
    window.open(`mailto:replayclubrecords@gmail.com?subject=${subject}&body=${body}`, "_self");
    toast.success("Opening your email client...");
  };

  // Equipment add-ons are optional. Disk Jockey Sessions still require a bundle to be
  // selected (which auto-fills equipment), so the default "essentials" bundle
  // keeps that flow ready out of the gate. Music requires a layout pick when
  // any layouts are configured.
  const musicHasLayouts = isMusic && (musicConfig?.layouts?.length ?? 0) > 0;
  const isReady = isDJ
    ? selectedEquipment.length > 0
    : isMusic
      ? (!musicHasLayouts || !!selectedLayout)
      : true;
  const isInquiryReady = inquiryName.trim() && inquiryEmail.trim() && inquiryMessage.trim();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          disabled={isContinuing}
          className="chrome-btn-outline text-[10px] uppercase tracking-[0.12em] font-display font-semibold px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ← Back
        </button>
        <div>
          <p className="text-muted-foreground text-[10px] font-body uppercase tracking-[0.2em]">
            {isLivestream ? "Inquire About" : "Customize Your"}
          </p>
          <h2 className="font-display text-xl font-bold chrome-text">
            {room.title}
          </h2>
        </div>
      </div>

      {isPaused && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-6 text-center">
          <p className="font-display text-sm font-bold text-amber-300 uppercase tracking-wider mb-1">
            Bookings temporarily paused
          </p>
          <p className="text-xs font-body text-muted-foreground">
            {room.title} bookings are currently unavailable. Please check back soon.
          </p>
        </div>
      )}
      {!isPaused && (<>
      {isLivestream ? (
        /* Livestream Inquiry Form */
        <div className="space-y-5">
          <p className="text-xs font-body text-muted-foreground leading-relaxed">
            Livestream packages are custom-tailored to your event. Fill out the form below and our team will get back to you with a quote.
          </p>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-display font-semibold uppercase tracking-[0.1em] text-foreground mb-1.5 block">
                Name *
              </label>
              <input
                type="text"
                value={inquiryName}
                onChange={(e) => setInquiryName(e.target.value)}
                placeholder="Your full name"
                maxLength={100}
                className={inputClasses}
              />
            </div>
            <div>
              <label className="text-[10px] font-display font-semibold uppercase tracking-[0.1em] text-foreground mb-1.5 block">
                Email *
              </label>
              <input
                type="email"
                value={inquiryEmail}
                onChange={(e) => setInquiryEmail(e.target.value)}
                placeholder="you@email.com"
                maxLength={255}
                className={inputClasses}
              />
            </div>
            <div>
              <label className="text-[10px] font-display font-semibold uppercase tracking-[0.1em] text-foreground mb-1.5 block">
                Phone
              </label>
              <input
                type="tel"
                value={inquiryPhone}
                onChange={(e) => setInquiryPhone(e.target.value)}
                placeholder="(Optional)"
                maxLength={20}
                className={inputClasses}
              />
            </div>
            <div>
              <label className="text-[10px] font-display font-semibold uppercase tracking-[0.1em] text-foreground mb-1.5 block">
                Tell us about your event *
              </label>
              <textarea
                value={inquiryMessage}
                onChange={(e) => setInquiryMessage(e.target.value)}
                placeholder="Event type, date, expected audience, any special requirements..."
                maxLength={1000}
                rows={4}
                className={cn(inputClasses, "resize-none")}
              />
            </div>
          </div>

          <button
            onClick={handleInquirySubmit}
            disabled={!isInquiryReady}
            className={cn(
              "w-full py-3 rounded-md font-display font-semibold text-xs uppercase tracking-[0.15em] transition-all",
              isInquiryReady
                ? "chrome-btn"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            Submit Inquiry
          </button>
        </div>
      ) : (
        <>
          {isMusic ? (
            <>
              {/* Music — Tier overview (read-only info from studio_configurations) */}
              <div>
                <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-[0.1em] mb-3 flex items-center gap-2">
                  <span className="w-5 h-px bg-chrome" />
                  Session Tiers
                </h3>
                <p className="text-[11px] font-body text-muted-foreground mb-3">
                  Pick your tier on the next step. Here's what each includes:
                </p>
                <div className="space-y-2">
                  {(musicConfig?.tiers ?? []).map((tier) => (
                    <div
                      key={tier.id}
                      className="rounded-lg border border-border/40 p-3"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-display text-xs font-bold text-foreground">{tier.label}</span>
                        {tier.price_cents_per_hour > 0 && (
                          <span className="font-display text-[11px] font-semibold chrome-text">
                            ${Math.round(tier.price_cents_per_hour / 100)}/hr
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {tier.features.map((f) => (
                          <span key={f} className="px-2 py-1 rounded text-[10px] font-body bg-muted/50 text-muted-foreground">
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Music — Layout picker */}
              {musicHasLayouts && (
                <div>
                  <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-[0.1em] mb-3 flex items-center gap-2">
                    <span className="w-5 h-px bg-chrome" />
                    Choose Your Room Setup
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {(musicConfig?.layouts ?? []).map((layout) => {
                      const isActive = selectedLayout === layout.id;
                      return (
                        <button
                          key={layout.id}
                          onClick={() => setSelectedLayout(layout.id)}
                          className={cn(
                            "text-left rounded-lg border p-3 transition-all",
                            isActive
                              ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                              : "border-border/40 hover:border-primary/40 hover:bg-card/80"
                          )}
                        >
                          <span className="font-display text-xs font-bold text-foreground block">{layout.name}</span>
                          {layout.description && (
                            <span className="text-[10px] font-body text-muted-foreground">{layout.description}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Music — Add-ons */}
              {(musicConfig?.addons?.length ?? 0) > 0 && (
                <div>
                  <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-[0.1em] mb-3 flex items-center gap-2">
                    <span className="w-5 h-px bg-chrome" />
                    Add-Ons
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {(musicConfig?.addons ?? []).map((addon) => {
                      const isActive = selectedMusicAddons.includes(addon.id);
                      const priceLabel = addon.price_cents > 0
                        ? ` · $${Math.round(addon.price_cents / 100)}`
                        : "";
                      return (
                        <button
                          key={addon.id}
                          onClick={() => toggleMusicAddon(addon.id)}
                          className={cn(
                            "px-3 py-2 rounded-md text-xs font-body transition-all border",
                            isActive ? "chrome-btn border-transparent" : "chrome-btn-outline"
                          )}
                          title={addon.description}
                        >
                          {addon.name}{priceLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
          <>
          {/* Equipment */}
          <div>
            <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-[0.1em] mb-3 flex items-center gap-2">
              <span className="w-5 h-px bg-chrome" />
              {isDJ ? "Choose Your Bundle" : room.title === "Podcast" ? "Add-Ons" : "Equipment"}
            </h3>

            {room.title === "Podcast" && (
              <div className="mb-3 rounded-md border border-chrome/30 bg-chrome/5 p-3">
                <p className="font-display text-[10px] font-semibold uppercase tracking-[0.1em] text-chrome mb-1.5">
                  Included with every podcast session
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {["SHURE SM7B x2", "Pro Lighting Package"].map((item) => (
                    <span
                      key={item}
                      className="px-2 py-1 rounded text-[10px] font-body bg-muted/50 text-foreground"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {isDJ ? (
              <div className="space-y-3">
                {djBundles.map((bundle) => {
                  const isActive = selectedBundle === bundle.id;
                  const bundleTotal = bundle.items.reduce((sum, item) => sum + (rentalPriceMap[item] || 0), 0);
                  return (
                    <button
                      key={bundle.id}
                      onClick={() => selectBundle(bundle.id)}
                      className={cn(
                        "w-full text-left rounded-lg border p-4 transition-all",
                        isActive
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-border/40 hover:border-primary/40 hover:bg-card/80"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-display text-sm font-bold text-foreground">{bundle.name}</span>
                        <span className="font-display text-xs font-semibold chrome-text">${bundleTotal}/day</span>
                      </div>
                      <p className="text-[11px] font-body text-muted-foreground mb-3">{bundle.desc}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {bundle.items.map((item) => (
                          <span
                            key={item}
                            className={cn(
                              "px-2 py-1 rounded text-[10px] font-body",
                              isActive
                                ? "bg-primary/10 text-primary"
                                : "bg-muted/50 text-muted-foreground"
                            )}
                            title={item === "Custom Background" ? "Black Abyss · Greenscreen · Office White · Wood Grid" : undefined}
                          >
                            {item === "Custom Background" ? "Background (4 options)" : item}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {equipment.map((item) => (
                  <button
                    key={item}
                    onClick={() => toggleEquipment(item)}
                    className={cn(
                      "px-3 py-2 rounded-md text-xs font-body transition-all border",
                      selectedEquipment.includes(item)
                        ? "chrome-btn border-transparent"
                        : "chrome-btn-outline"
                    )}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Background Picker – shown for DJ bundles and Podcast */}
          {(isDJ && selectedBundle || room.title === "Podcast") && (
            <div>
              <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-[0.1em] mb-3 flex items-center gap-2">
                <span className="w-5 h-px bg-chrome" />
                Choose Your Background
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {backgroundOptions.map((bg) => {
                  const isActive = selectedBackground === bg.id;
                  return (
                    <button
                      key={bg.id}
                      onClick={() => setSelectedBackground(bg.id)}
                      className={cn(
                        "text-left rounded-lg border p-3 transition-all",
                        isActive
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-border/40 hover:border-primary/40 hover:bg-card/80"
                      )}
                    >
                      <span className="font-display text-xs font-bold text-foreground block">{bg.label}</span>
                      <span className="text-[10px] font-body text-muted-foreground">{bg.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          </>
          )}

          {/* Continue Button */}
          <button
            onClick={handleContinue}
            disabled={!isReady || isContinuing}
            className={cn(
              "w-full py-3 rounded-md font-display font-semibold text-xs uppercase tracking-[0.15em] transition-all flex items-center justify-center gap-2",
              isReady && !isContinuing
                ? "chrome-btn"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            {isContinuing ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Loading…
              </>
            ) : (
              "Continue to Booking"
            )}
          </button>
        </>
      )}
      </>)}
    </motion.div>
  );
};

export default CustomizeSession;
