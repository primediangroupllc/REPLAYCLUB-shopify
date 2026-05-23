import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart, X, Minus, Plus, Check, Loader2, LogIn, ArrowLeft, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { reportBookingFailure } from "@/lib/bookingFailureReporter";
import { dataUrlToBlob } from "@/lib/utils";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import ConsentBlock from "@/components/ConsentBlock";
import {
  EQUIPMENT_TURNAROUND_BUFFER_DAYS,
  logEquipmentBlockEvent,
} from "@/lib/serviceEquipmentDependencies";
import { useServiceEquipmentRequirements } from "@/hooks/useServiceEquipmentRequirements";

const DAY_OPTIONS = [
  { days: 1, label: "1 Day", discount: 0 },
  { days: 3, label: "3 Days", discount: 0.05 },
  { days: 7, label: "7 Days", discount: 0.1 },
];

// Platform/transaction fee removed for public launch (PR 4c).
const FEE_CENTS = 0;

// Catalog item shape. Loaded live from the admin-managed `custom_equipment_items`
// table so the rental store, the homepage section, and the admin Equipment panel
// all share one source of truth.
type EquipmentItem = {
  name: string;
  priceCents: number;
  icon: typeof Package;
  description: string;
};

const EquipmentRentalCart = () => {
  const navigate = useNavigate();
  const { byTitle: depsByTitle, getServicesUsing } = useServiceEquipmentRequirements();
  const [cart, setCart] = useState<Map<string, number>>(new Map());
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [rentalDays, setRentalDays] = useState(1);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [lockedItems, setLockedItems] = useState<Set<string>>(new Set());
  const [activeLockIds, setActiveLockIds] = useState<string[]>([]);
  // Items unavailable because a dependent service (e.g. Disk Jockey) is
  // already booked within the rental window starting today. Map of item -> reason.
  const [serviceConflicts, setServiceConflicts] = useState<Map<string, string>>(new Map());
  // Re-used for the lifetime of this checkout attempt — prevents Stripe from
  // creating duplicate sessions on double-click.
  const [stripeIdempotencyKey, setStripeIdempotencyKey] = useState<string | null>(null);

  // Consent gate
  const [showConsent, setShowConsent] = useState(false);
  const [consentSignerName, setConsentSignerName] = useState("");
  const [consentSignature, setConsentSignature] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  // Load the rental catalog from the admin-managed table — single source of
  // truth. Bookable items only, in the admin's sort order.
  useEffect(() => {
    let cancelled = false;
    supabase
      .from("custom_equipment_items")
      .select("name,description,price_cents,sort_order,bookable")
      .eq("bookable", true)
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        if (cancelled || !data) return;
        setEquipment(
          data.map((c: any) => ({
            name: c.name,
            priceCents: c.price_cents || 0,
            icon: Package,
            description: c.description || "",
          })),
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Check for success param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") {
      toast.success("Rental confirmed! Check your email for pickup details.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Poll active equipment locks every 30s so the UI shows what's held by others.
  useEffect(() => {
    const fetchLocks = async () => {
      const { data } = await supabase.rpc("get_active_equipment_locks");
      if (!data) return;
      // The RPC strips the locker's email for privacy. Items the current user
      // holds are tracked via `activeLockIds`; subtract those from the held set.
      const myLockIds = new Set(activeLockIds);
      const held = new Set<string>();
      for (const row of data as Array<{ id: string; equipment_name: string }>) {
        if (!myLockIds.has(row.id)) held.add(row.equipment_name);
      }
      setLockedItems(held);
    };
    fetchLocks();
    const interval = setInterval(fetchLocks, 30000);
    return () => clearInterval(interval);
  }, [user?.email, activeLockIds]);

  // Release any equipment locks the user holds when they unmount or close.
  const releaseHeldLocks = async () => {
    if (activeLockIds.length === 0) return;
    try {
      await supabase.rpc("release_equipment_locks", { p_lock_ids: activeLockIds });
    } catch (e) {
      console.error("Failed to release equipment locks", e);
    }
    setActiveLockIds([]);
  };

  useEffect(() => {
    return () => {
      if (activeLockIds.length > 0) {
        supabase.rpc("release_equipment_locks", { p_lock_ids: activeLockIds }).then(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reverse dependency check: if any equipment item is required by a service
  // (e.g. AlphaTheta XDJ-AZ → Disk Jockey) and that service has paid bookings
  // within the upcoming `rentalDays` window starting today, block the rental.
  useEffect(() => {
    const fetchConflicts = async () => {
      const tracked = Object.values(depsByTitle).flat();
      if (tracked.length === 0) {
        setServiceConflicts(new Map());
        return;
      }
      const today = new Date();
      // Apply turnaround buffer (#3) on both ends so a session that ends
      // the day before pickup also blocks the rental.
      const start = new Date(today);
      start.setDate(start.getDate() - EQUIPMENT_TURNAROUND_BUFFER_DAYS);
      const startStr = start.toISOString().slice(0, 10);
      const end = new Date(today);
      end.setDate(
        end.getDate() + Math.max(1, rentalDays) - 1 + EQUIPMENT_TURNAROUND_BUFFER_DAYS,
      );
      const endStr = end.toISOString().slice(0, 10);

      // Fetch paid bookings within the window for any service that depends
      // on tracked equipment.
      const services = Object.keys(depsByTitle);
      const { data } = await supabase
        .from("bookings")
        .select("room_title, booking_date")
        .in("payment_status", ["paid", "promo"])
        .in("room_title", services)
        .gte("booking_date", startStr)
        .lte("booking_date", endStr);

      const conflicts = new Map<string, string>();
      (data || []).forEach((b: any) => {
        const items = depsByTitle[b.room_title] || [];
        items.forEach((item) => {
          if (!conflicts.has(item)) {
            conflicts.set(item, `${b.room_title} booked ${b.booking_date}`);
          }
        });
      });
      setServiceConflicts(conflicts);
    };
    fetchConflicts();
  }, [rentalDays, depsByTitle]);

  const addToCart = (name: string) => {
    if (lockedItems.has(name)) {
      toast.error(`${name} is currently held by another renter. Try again shortly.`);
      return;
    }
    if (serviceConflicts.has(name)) {
      const services = getServicesUsing(name).join(", ");
      toast.error(
        `${name} is reserved for an upcoming ${services} session in your rental window. Try a shorter rental or different dates.`,
      );
      // Analytics (#6): track that a rental was blocked by a service booking.
      logEquipmentBlockEvent({
        supabase,
        equipmentName: name,
        service: services || "Equipment Rental",
        blockDirection: "rental_blocked_by_service",
        blockedDate: null,
        userEmail: user?.email || null,
      });
      return;
    }
    setCart((prev) => {
      const next = new Map(prev);
      next.set(name, (next.get(name) || 0) + 1);
      return next;
    });
    if (!isOpen) setIsOpen(true);
  };

  const removeFromCart = (name: string) => {
    setCart((prev) => {
      const next = new Map(prev);
      const count = next.get(name) || 0;
      if (count <= 1) next.delete(name);
      else next.set(name, count - 1);
      return next;
    });
  };

  const clearItem = (name: string) => {
    setCart((prev) => {
      const next = new Map(prev);
      next.delete(name);
      return next;
    });
  };

  const dayOption = DAY_OPTIONS.find((d) => d.days === rentalDays) || DAY_OPTIONS[0];
  const subtotalCents = Array.from(cart.entries()).reduce((sum, [name, qty]) => {
    const item = equipment.find((e) => e.name === name);
    if (!item) return sum;
    const dailyRate = Math.round(item.priceCents * (1 - dayOption.discount));
    return sum + dailyRate * rentalDays * qty;
  }, 0);
  const totalCents = subtotalCents + FEE_CENTS;
  const cartCount = Array.from(cart.values()).reduce((a, b) => a + b, 0);

  const proceedToConsent = () => {
    if (!user) {
      toast.error("Please sign in to rent equipment");
      navigate("/auth");
      return;
    }
    if (cart.size === 0) return;
    if (!consentSignerName) {
      setConsentSignerName(user.user_metadata?.display_name || "");
    }
    setShowConsent(true);
  };

  const handleCheckout = async () => {
    if (!user || cart.size === 0) return;
    if (!consentSignature || !consentSignerName.trim()) {
      toast.error("Please sign the rental agreement first");
      return;
    }

    setLoading(true);
    try {
      // Upload consent signature to private bucket
      let consentSignaturePath: string | null = null;
      try {
        const blob = dataUrlToBlob(consentSignature);
        const sigPath = `rentals/${user.id}/${crypto.randomUUID()}.png`;
        const { error: sigErr } = await supabase.storage
          .from("consent-signatures")
          .upload(sigPath, blob, { contentType: "image/png" });
        if (sigErr) throw sigErr;
        consentSignaturePath = sigPath;
      } catch (e: any) {
        throw new Error("Could not save signature: " + (e.message || "upload failed"));
      }

      const items = Array.from(cart.entries()).map(([name]) => {
        const item = equipment.find((e) => e.name === name)!;
        const dailyRate = Math.round(item.priceCents * (1 - dayOption.discount));
        return { name, priceCents: dailyRate };
      });

      const { data, error } = await supabase.functions.invoke("create-equipment-rental-payment", {
        body: {
          items,
          rentalDays,
          pickupDate: null,
          consentSignaturePath,
          consentSignerName: consentSignerName.trim(),
          idempotencyKey: (() => {
            if (stripeIdempotencyKey) return stripeIdempotencyKey;
            const k = `er-${crypto.randomUUID()}`;
            setStripeIdempotencyKey(k);
            return k;
          })(),
        },
      });

      if (error) throw error;
      if (data?.url) {
        if (Array.isArray(data?.lockIds)) setActiveLockIds(data.lockIds);
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to start checkout. Please try again.");
      reportBookingFailure({
        stage: "create-equipment-rental-payment",
        error: err,
        service: "Equipment Rental",
        customerName: consentSignerName?.trim() || null,
        customerEmail: user?.email || null,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Equipment Grid with Add buttons */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          {/* Cart Button — centered above the heading */}
          <div className="flex justify-center mb-4">
            <motion.button
              onClick={() => setIsOpen(true)}
              className="relative chrome-btn rounded-full w-14 h-14 flex items-center justify-center shadow-lg"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label="Open cart"
            >
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </motion.button>
          </div>
          <h2 className="font-display text-xl md:text-2xl font-bold text-foreground mb-8 text-center">
            Select Your Gear
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {equipment.map((item, i) => {
              const Icon = item.icon;
              const qty = cart.get(item.name) || 0;
              const dailyRate = Math.round(item.priceCents * (1 - dayOption.discount));
              const isHeldByOther = lockedItems.has(item.name);
              const serviceConflict = serviceConflicts.get(item.name);
              const isUnavailable = isHeldByOther || !!serviceConflict;
              return (
                <motion.div
                  key={item.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className={`group relative rounded-lg border bg-card/50 backdrop-blur-sm p-5 transition-all duration-300 ${
                    isUnavailable
                      ? "border-border/20 opacity-50"
                      :
                    qty > 0
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border/30 hover:border-primary/40 hover:bg-card/80"
                  }`}
                  title={serviceConflict || undefined}
                >
                  {qty > 0 && (
                    <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                  {isHeldByOther && !serviceConflict && (
                    <div className="absolute top-2.5 right-2.5 text-[9px] font-display font-semibold uppercase tracking-wider text-muted-foreground">
                      On Hold
                    </div>
                  )}
                  {serviceConflict && (
                    <div className="absolute top-2.5 right-2.5 text-[9px] font-display font-semibold uppercase tracking-wider text-muted-foreground">
                      Reserved
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-2 rounded-md ${qty > 0 ? "bg-primary/10 text-primary" : "bg-primary/5 text-primary/70"}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                  <h3 className="font-display text-sm font-semibold text-foreground mb-1">{item.name}</h3>
                  <p className="text-muted-foreground text-xs font-body leading-relaxed mb-1">{item.description}</p>
                  <p className="font-display text-sm font-bold chrome-text mb-3">
                    ${(dailyRate / 100).toFixed(0)}/day
                    {dayOption.discount > 0 && (
                      <span className="text-[10px] text-primary ml-1.5 font-body font-normal">
                        {Math.round(dayOption.discount * 100)}% off
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    {qty === 0 ? (
                      <button
                        onClick={() => addToCart(item.name)}
                        disabled={isUnavailable}
                        className="w-full py-1.5 rounded-md border border-primary/40 text-primary text-[11px] font-display font-semibold uppercase tracking-wider hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                      >
                        {serviceConflict ? "Reserved" : isHeldByOther ? "Unavailable" : "Add to Cart"}
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 w-full">
                        <button
                          onClick={() => removeFromCart(item.name)}
                          className="p-1.5 rounded-md border border-border/40 hover:bg-card transition-colors"
                        >
                          <Minus className="w-3 h-3 text-muted-foreground" />
                        </button>
                        <span className="font-display text-sm font-bold text-foreground flex-1 text-center">{qty}</span>
                        <button
                          onClick={() => addToCart(item.name)}
                          className="p-1.5 rounded-md border border-border/40 hover:bg-card transition-colors"
                        >
                          <Plus className="w-3 h-3 text-muted-foreground" />
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Slide-out Cart Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-[linear-gradient(160deg,hsl(0_0%_9%)_0%,hsl(0_0%_6%)_50%,hsl(0_0%_8%)_100%)] border-l border-border/40 shadow-[-12px_0_40px_-12px_hsl(0_0%_0%/0.8)] flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/20">
                <div className="flex items-center gap-2">
                  {showConsent && (
                    <button
                      onClick={() => setShowConsent(false)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Back to cart"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  )}
                  <h3 className="font-display text-base font-bold text-foreground">
                    {showConsent ? "Rental Agreement" : "Your Cart"}
                  </h3>
                </div>
                <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {showConsent ? (
                <>
                  <div className="flex-1 overflow-y-auto px-5 py-4">
                    <ConsentBlock
                      variant="rental"
                      signerName={consentSignerName}
                      onSignerNameChange={setConsentSignerName}
                      onSignatureChange={setConsentSignature}
                    />
                  </div>
                  <div className="px-5 py-4 border-t border-border/20 space-y-3">
                    <div className="flex justify-between font-display text-sm font-bold text-foreground">
                      <span>Total</span>
                      <span className="chrome-text">${(totalCents / 100).toFixed(2)}</span>
                    </div>
                    <button
                      onClick={handleCheckout}
                      disabled={loading || !consentSignature || !consentSignerName.trim()}
                      className="w-full chrome-btn font-display font-semibold text-xs uppercase tracking-[0.15em] py-3 rounded-md disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        "Sign & Pay with Stripe"
                      )}
                    </button>
                  </div>
                </>
              ) : (
              <>

              {/* Day selector */}
              <div className="px-5 py-4 border-b border-border/20">
                <p className="text-[11px] font-body uppercase tracking-[0.15em] text-muted-foreground mb-2">
                  Rental Duration
                </p>
                <div className="flex gap-2">
                  {DAY_OPTIONS.map((opt) => (
                    <button
                      key={opt.days}
                      onClick={() => setRentalDays(opt.days)}
                      className={`flex-1 py-2 rounded-md text-xs font-display font-semibold border transition-all ${
                        rentalDays === opt.days
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border/40 text-muted-foreground hover:text-foreground hover:border-border"
                      }`}
                    >
                      {opt.label}
                      {opt.discount > 0 && (
                        <span className="block text-[9px] text-primary font-body font-normal mt-0.5">
                          Save {Math.round(opt.discount * 100)}%
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Items */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {cart.size === 0 ? (
                  <p className="text-center text-muted-foreground text-sm font-body py-8">
                    Your cart is empty
                  </p>
                ) : (
                  Array.from(cart.entries()).map(([name, qty]) => {
                    const item = equipment.find((e) => e.name === name);
                    if (!item) return null;
                    const dailyRate = Math.round(item.priceCents * (1 - dayOption.discount));
                    const lineTotal = dailyRate * rentalDays * qty;
                    return (
                      <div key={name} className="card-premium flex items-start gap-3 p-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-display text-sm font-semibold text-foreground truncate">{name}</p>
                          <p className="text-[11px] font-body text-muted-foreground">
                            ${(dailyRate / 100).toFixed(0)}/day × {rentalDays}d × {qty}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-display text-sm font-bold chrome-text">
                            ${(lineTotal / 100).toFixed(2)}
                          </p>
                          <button onClick={() => clearItem(name)} className="text-[10px] text-destructive hover:underline font-body mt-0.5">
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              {cart.size > 0 && (
                <div className="px-5 py-4 border-t border-border/20 space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-body text-muted-foreground">
                      <span>Subtotal</span>
                      <span>${(subtotalCents / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-display text-sm font-bold text-foreground pt-1 border-t border-border/20">
                      <span>Total</span>
                      <span className="chrome-text">${(totalCents / 100).toFixed(2)}</span>
                    </div>
                  </div>
                  <button
                    onClick={proceedToConsent}
                    disabled={loading}
                    className="w-full chrome-btn font-display font-semibold text-xs uppercase tracking-[0.15em] py-3 rounded-md disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {!user ? (
                      <>
                        <LogIn className="w-4 h-4" />
                        Sign In to Checkout
                      </>
                    ) : (
                      "Continue to Agreement →"
                    )}
                  </button>
                </div>
              )}
              </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default EquipmentRentalCart;
