import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Calendar, Clock, MapPin, Users, Ticket, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePublicSiteSettings } from "@/hooks/useSiteSettings";
import logo from "@/assets/logo.png";
import FAQSection from "@/components/FAQSection";
import HCaptchaWidget from "@/components/HCaptchaWidget";
import SeoHead from "@/components/SeoHead";
import TicketPass, { type TicketPassData } from "@/components/TicketPass";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PageBreadcrumbs from "@/components/PageBreadcrumbs";

interface EventRow {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  event_date: string;
  start_time: string;
  end_time: string | null;
  room_title: string | null;
  location: string | null;
  capacity: number;
  price_cents: number;
  show_price: boolean;
  cover_image_url: string | null;
  status: string;
  refund_policy: string | null;
}

interface Tier {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  capacity: number;
  sort_order: number;
  sold_out: boolean;
  is_free: boolean;
}

interface LineupItem {
  id: string;
  name: string;
  role: string | null;
  bio: string | null;
  photo_url: string | null;
  sort_order: number;
}

interface GalleryItem {
  id: string;
  image_url: string;
  caption: string | null;
  sort_order: number;
}

const formatTime = (t: string) => {
  if (!t) return "";
  const [hh, mm] = t.split(":").map((n) => parseInt(n, 10));
  if (Number.isNaN(hh)) return t;
  const period = hh >= 12 ? "PM" : "AM";
  const h12 = ((hh + 11) % 12) + 1;
  return `${h12}:${String(mm || 0).padStart(2, "0")} ${period}`;
};

const formatDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
};

const EventDetail = () => {
  const { slugOrId } = useParams<{ slugOrId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { settings: siteSettings } = usePublicSiteSettings();
  const eventsPaused = !!siteSettings.booking_pauses?.events;
  const [searchParams, setSearchParams] = useSearchParams();
  const [phonePromptOpen, setPhonePromptOpen] = useState(false);
  const [rsvpPhone, setRsvpPhone] = useState("");

  const [event, setEvent] = useState<EventRow | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [lineup, setLineup] = useState<LineupItem[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [counts, setCounts] = useState<{ confirmed: number; waitlist: number }>({ confirmed: 0, waitlist: 0 });
  const [tierCounts, setTierCounts] = useState<Record<string, number>>({});
  const [user, setUser] = useState<{ email: string; id: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifyCaptcha, setNotifyCaptcha] = useState<string | null>(null);
  const [notifyDone, setNotifyDone] = useState(false);
  const [purchasedTicket, setPurchasedTicket] = useState<TicketPassData | null>(null);

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) setUser({ email: session.user.email, id: session.user.id });
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user?.email ? { email: session.user.email, id: session.user.id } : null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load event by slug or id
  useEffect(() => {
    if (!slugOrId) return;
    (async () => {
      // Try slug first; if it looks like a UUID, try id too
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);
      let row: EventRow | null = null;
      if (isUuid) {
        const { data } = await supabase.from("events").select("*").eq("id", slugOrId).maybeSingle();
        row = data as EventRow | null;
      }
      if (!row) {
        const { data } = await supabase.from("events").select("*").eq("slug", slugOrId).maybeSingle();
        row = data as EventRow | null;
      }
      if (!row) {
        toast({ title: "Event not found", variant: "destructive" });
        navigate("/events");
        return;
      }
      setEvent(row);

      const [tiersRes, lineupRes, galleryRes, attRes] = await Promise.all([
        supabase.from("event_ticket_tiers").select("*").eq("event_id", row.id).order("sort_order"),
        supabase.from("event_lineup").select("*").eq("event_id", row.id).order("sort_order"),
        supabase.from("event_gallery").select("*").eq("event_id", row.id).order("sort_order"),
        supabase.rpc("get_event_attendance", { p_event_id: row.id }),
      ]);
      setTiers((tiersRes.data as Tier[]) || []);
      setLineup((lineupRes.data as LineupItem[]) || []);
      setGallery((galleryRes.data as GalleryItem[]) || []);
      const att = (attRes.data as { confirmed_count?: number; waitlist_count?: number } | null) || {};
      setCounts({ confirmed: att.confirmed_count || 0, waitlist: att.waitlist_count || 0 });

      // per-tier sold counts
      const tierIds = ((tiersRes.data as Tier[]) || []).map((t) => t.id);
      if (tierIds.length) {
        const { data: rsvps } = await supabase
          .from("event_rsvps")
          .select("ticket_tier_id")
          .in("ticket_tier_id", tierIds)
          .eq("payment_status", "paid")
          .eq("status", "confirmed");
        const tc: Record<string, number> = {};
        (rsvps || []).forEach((r: { ticket_tier_id: string | null }) => {
          if (r.ticket_tier_id) tc[r.ticket_tier_id] = (tc[r.ticket_tier_id] || 0) + 1;
        });
        setTierCounts(tc);
      }
    })();
  }, [slugOrId, navigate, toast]);

  // Stripe return handler
  useEffect(() => {
    const sessionId = searchParams.get("ticket_session_id");
    const rsvpId = searchParams.get("rsvp_id");
    const cancelled = searchParams.get("ticket_cancelled");
    if (cancelled) {
      toast({ title: "Payment cancelled", description: "Your ticket was not purchased." });
      searchParams.delete("ticket_cancelled");
      setSearchParams(searchParams, { replace: true });
      return;
    }
    if (sessionId && rsvpId) {
      (async () => {
        const { data, error } = await supabase.functions.invoke("verify-event-ticket-payment", {
          body: { sessionId, rsvpId },
        });
        if (error || !data?.success) {
          toast({ title: "Payment verification failed", description: error?.message || "Please contact us.", variant: "destructive" });
        } else {
          toast({ title: "🎟️ Ticket confirmed!", description: "Check your email for your ticket." });
          const { data: rsvpRow } = await supabase
            .from("event_rsvps")
            .select("id, ticket_code, user_name, status, payment_status, amount_paid_cents, events(*)")
            .eq("id", rsvpId)
            .maybeSingle();
          if (rsvpRow?.ticket_code && rsvpRow.events) {
            setPurchasedTicket({
              id: rsvpRow.id,
              ticket_code: rsvpRow.ticket_code,
              user_name: rsvpRow.user_name,
              status: rsvpRow.status,
              payment_status: rsvpRow.payment_status,
              amount_paid_cents: rsvpRow.amount_paid_cents,
              event: rsvpRow.events as TicketPassData["event"],
            });
          }
        }
        searchParams.delete("ticket_session_id");
        searchParams.delete("rsvp_id");
        setSearchParams(searchParams, { replace: true });
      })();
    }
  }, [searchParams, setSearchParams, toast]);

  const buyTier = async (tier: Tier) => {
    if (!event) return;
    if (eventsPaused) {
      toast({ title: "Bookings temporarily paused", description: "Event ticketing is currently unavailable. Please check back soon.", variant: "destructive" });
      return;
    }
    if (!user) {
      navigate(`/auth?redirect=/events/${event.slug ?? event.id}`);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-event-ticket-payment", {
        body: {
          eventId: event.id,
          tierId: tier.id,
          customerName: user.email.split("@")[0],
          customerEmail: user.email,
        },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e) {
      toast({ title: "Checkout failed", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const buyEvent = async () => {
    if (!event) return;
    if (eventsPaused) {
      toast({ title: "Bookings temporarily paused", description: "Event ticketing is currently unavailable. Please check back soon.", variant: "destructive" });
      return;
    }
    if (!user) {
      navigate(`/auth?redirect=/events/${event.slug ?? event.id}`);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-event-ticket-payment", {
        body: {
          eventId: event.id,
          customerName: user.email.split("@")[0],
          customerEmail: user.email,
        },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e) {
      toast({ title: "Checkout failed", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const openFreeRsvp = () => {
    if (!event) return;
    if (eventsPaused) {
      toast({ title: "Bookings temporarily paused", description: "Event RSVPs are currently unavailable. Please check back soon.", variant: "destructive" });
      return;
    }
    if (!user) {
      navigate(`/auth?redirect=/events/${event.slug ?? event.id}`);
      return;
    }
    setPhonePromptOpen(true);
  };

  const submitFreeRsvp = async () => {
    if (!event || !user) return;
    setLoading(true);
    try {
      const isFull = counts.confirmed >= event.capacity;
      const status = isFull ? "waitlist" : "confirmed";
      const phone = rsvpPhone.trim();
      const { error } = await supabase.from("event_rsvps").insert({
        event_id: event.id,
        user_id: user.id,
        user_email: user.email,
        user_name: user.email.split("@")[0],
        user_phone: phone || null,
        status,
        payment_status: "free",
      });
      if (error) throw error;
      setPhonePromptOpen(false);
      setRsvpPhone("");
      toast({
        title: status === "waitlist" ? "Added to waitlist" : "You're in!",
        description: status === "waitlist" ? "We'll email you if a spot opens." : "Confirmation email on the way.",
      });
      setCounts((c) => ({
        confirmed: status === "confirmed" ? c.confirmed + 1 : c.confirmed,
        waitlist: status === "waitlist" ? c.waitlist + 1 : c.waitlist,
      }));
    } catch (e) {
      toast({ title: "RSVP failed", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const submitNotify = async () => {
    if (!event) return;
    const raw = notifyEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
      toast({ title: "Enter a valid email", variant: "destructive" });
      return;
    }
    if (!notifyCaptcha) {
      toast({ title: "Complete the captcha", variant: "destructive" });
      return;
    }
    try {
      const { data: c } = await supabase.functions.invoke("verify-captcha", { body: { token: notifyCaptcha } });
      if (!c?.success) throw new Error("Captcha failed");
      const { error } = await supabase.from("event_notify_signups").insert({
        event_id: event.id, email: raw.toLowerCase(),
      });
      if (error && !/duplicate|unique/i.test(error.message)) throw error;
      setNotifyDone(true);
      toast({ title: "You're on the list" });
    } catch (e) {
      toast({ title: "Signup failed", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    }
  };

  const tiersAvailable = tiers.length > 0;
  const hasFreeTier = useMemo(() => tiers.some((t) => t.is_free || t.price_cents === 0), [tiers]);
  const showFallbackPaid = !tiersAvailable && event && event.price_cents > 0;
  const showFallbackFree = !tiersAvailable && event && event.price_cents === 0;

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-mono text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SeoHead
        title={`${event.title} | Replay Club Events`}
        description={event.description?.slice(0, 155) || `${event.title} at Replay Club Los Angeles`}
        image={event.cover_image_url || undefined}
      />

      <nav className="sticky top-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border/30">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="w-12" />
          <button
            onClick={() => navigate("/")}
            aria-label="Go to homepage"
            className="transition-opacity hover:opacity-80"
          >
            <img src={logo} alt="Replay Club" className="w-24 mix-blend-screen" />
          </button>
          <div className="w-12" />
        </div>
      </nav>

      {/* HERO */}
      <section className="relative">
        {event.cover_image_url && (
          <div className="absolute inset-0 -z-10">
            <img src={event.cover_image_url} alt="" className="w-full h-full object-cover opacity-40" />
            <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
          </div>
        )}
        <div className="container mx-auto max-w-3xl px-4 py-16 md:py-24 text-center space-y-6">
          <PageBreadcrumbs
            className="flex justify-center"
            items={[
              { label: "Home", to: "/" },
              { label: "Events", to: "/events" },
              { label: event.title },
            ]}
          />
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">
            Replay Club Presents
          </p>
          <h1 className="font-display text-h1 chrome-text leading-tight">{event.title}</h1>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground font-body">
            <span className="inline-flex items-center gap-2"><Calendar className="w-4 h-4" /> {formatDate(event.event_date)}</span>
            <span className="inline-flex items-center gap-2"><Clock className="w-4 h-4" /> {formatTime(event.start_time)}{event.end_time ? ` – ${formatTime(event.end_time)}` : ""}</span>
            <span className="inline-flex items-center gap-2"><MapPin className="w-4 h-4" /> {event.location || event.room_title || "Replay Club"}</span>
            <span className="inline-flex items-center gap-2"><Users className="w-4 h-4" /> {Math.max(0, event.capacity - counts.confirmed)} spots left</span>
          </div>
        </div>
      </section>

      {/* DESCRIPTION */}
      {event.description && (
        <section className="container mx-auto max-w-2xl px-4 py-8">
          <p className="text-foreground/90 font-body whitespace-pre-wrap leading-relaxed">{event.description}</p>
        </section>
      )}

      {/* LINEUP */}
      {lineup.length > 0 && (
        <section className="container mx-auto max-w-4xl px-4 py-12 border-t border-border/40">
          <h2 className="text-h2 text-center font-display mb-8">Lineup</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {lineup.map((a) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden"
              >
                {a.photo_url ? (
                  <img src={a.photo_url} alt={a.name} className="w-full aspect-square object-cover" />
                ) : (
                  <div className="w-full aspect-square bg-gradient-to-br from-card to-background grid place-items-center">
                    <span className="font-display text-3xl chrome-text">{a.name.charAt(0)}</span>
                  </div>
                )}
                <div className="p-3 text-center space-y-1">
                  <p className="font-display font-bold text-sm uppercase tracking-wider">{a.name}</p>
                  {a.role && <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">{a.role}</p>}
                  {a.bio && <p className="text-xs text-muted-foreground font-body pt-1 line-clamp-3">{a.bio}</p>}
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* TICKETS */}
      <section className="container mx-auto max-w-2xl px-4 py-12 border-t border-border/40">
        <h2 className="text-h2 text-center font-display mb-2">Get Tickets</h2>
        <p className="text-center text-sm text-muted-foreground font-body mb-8">
          {!user && (<span className="inline-flex items-center gap-1.5"><Lock className="w-3 h-3" /> Sign in to RSVP or buy</span>)}
        </p>
        {eventsPaused && (
          <div className="mb-6 rounded-md border border-amber-500/40 bg-amber-500/10 p-6 text-center">
            <p className="font-display text-sm font-bold text-amber-300 uppercase tracking-wider mb-1">
              Bookings temporarily paused
            </p>
            <p className="text-xs font-body text-muted-foreground">
              Event ticketing is currently unavailable. Please check back soon.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {tiersAvailable && tiers.map((t) => {
            const sold = tierCounts[t.id] || 0;
            const remaining = Math.max(0, t.capacity - sold);
            const isOut = t.sold_out || (t.capacity > 0 && remaining === 0);
            return (
              <div key={t.id} className="rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm p-4 flex flex-wrap gap-3 items-center justify-between">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-baseline gap-2">
                    <h3 className="font-display font-bold text-base uppercase tracking-wider">{t.name}</h3>
                    <span className="font-mono text-sm text-foreground">
                      {t.is_free || t.price_cents === 0 ? "Free" : `$${(t.price_cents / 100).toFixed(0)}`}
                    </span>
                  </div>
                  {t.description && <p className="text-xs text-muted-foreground font-body mt-1">{t.description}</p>}
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mt-1">
                    {isOut ? "Sold out" : `${remaining} of ${t.capacity} left`}
                  </p>
                </div>
                {isOut ? (
                  <span className="px-4 py-2 rounded-md bg-muted text-muted-foreground text-xs font-display uppercase tracking-wider">Sold out</span>
                ) : t.is_free || t.price_cents === 0 ? (
                  <button onClick={openFreeRsvp} disabled={loading} className="btn-chrome px-5 py-2 text-xs uppercase tracking-[0.2em]">
                    RSVP
                  </button>
                ) : (
                  <button onClick={() => buyTier(t)} disabled={loading} className="btn-chrome px-5 py-2 text-xs uppercase tracking-[0.2em] inline-flex items-center gap-2">
                    <Ticket className="w-3.5 h-3.5" /> Buy
                  </button>
                )}
              </div>
            );
          })}

          {showFallbackPaid && (
            <div className="rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm p-4 flex flex-wrap gap-3 items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-base uppercase tracking-wider">Admission</h3>
                <p className="font-mono text-sm">${(event.price_cents / 100).toFixed(0)}</p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mt-1">
                  {Math.max(0, event.capacity - counts.confirmed)} of {event.capacity} left
                </p>
              </div>
              {counts.confirmed >= event.capacity ? (
                <span className="px-4 py-2 rounded-md bg-muted text-muted-foreground text-xs font-display uppercase tracking-wider">Sold out</span>
              ) : (
                <button onClick={buyEvent} disabled={loading} className="btn-chrome px-5 py-2 text-xs uppercase tracking-[0.2em] inline-flex items-center gap-2">
                  <Ticket className="w-3.5 h-3.5" /> Buy ticket
                </button>
              )}
            </div>
          )}

          {showFallbackFree && (
            <div className="rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm p-4 flex flex-wrap gap-3 items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-base uppercase tracking-wider">Free RSVP</h3>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mt-1">
                  {Math.max(0, event.capacity - counts.confirmed)} of {event.capacity} left
                </p>
              </div>
              <button onClick={openFreeRsvp} disabled={loading} className="btn-chrome px-5 py-2 text-xs uppercase tracking-[0.2em]">
                RSVP
              </button>
            </div>
          )}
        </div>

        {event.refund_policy && (
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mt-6 text-center">
            Refund policy: <span className="normal-case tracking-normal text-xs font-body">{event.refund_policy}</span>
          </p>
        )}
      </section>

      {/* GALLERY */}
      {gallery.length > 0 && (
        <section className="container mx-auto max-w-5xl px-4 py-12 border-t border-border/40">
          <h2 className="text-h2 text-center font-display mb-8">From past events</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {gallery.map((g) => (
              <div key={g.id} className="aspect-square rounded-lg overflow-hidden border border-border/40">
                <img src={g.image_url} alt={g.caption || ""} loading="lazy" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FAQ */}
      <FAQSection topic="events" heading="Event FAQ" />

      {/* NOTIFY ME */}
      <section className="container mx-auto max-w-md px-4 py-12 border-t border-border/40">
        <div className="text-center space-y-4">
          <h2 className="text-h2 font-display">Notify me of next event</h2>
          <p className="text-sm text-muted-foreground font-body">
            Get an email when the next Replay Club event drops.
          </p>
          {notifyDone ? (
            <div className="py-3 px-4 rounded-md bg-card border border-border/40 text-xs font-display uppercase tracking-wider text-muted-foreground">
              ✓ You'll be notified
            </div>
          ) : (
            <div className="space-y-3">
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                maxLength={255}
                value={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full bg-card border border-border/60 rounded-md px-3 py-2 text-sm font-body focus:outline-none focus:border-foreground/40"
              />
              <HCaptchaWidget onVerify={(token) => setNotifyCaptcha(token)} onExpire={() => setNotifyCaptcha(null)} />
              <button onClick={submitNotify} className="btn-chrome w-full px-5 py-2 text-xs uppercase tracking-[0.2em]">
                Notify me
              </button>
            </div>
          )}
        </div>
      </section>

      <Dialog open={!!purchasedTicket} onOpenChange={(open) => !open && setPurchasedTicket(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Your ticket</DialogTitle>
          </DialogHeader>
          {purchasedTicket && <TicketPass ticket={purchasedTicket} />}
        </DialogContent>
      </Dialog>

      <Dialog open={phonePromptOpen} onOpenChange={setPhonePromptOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm your RSVP</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground font-body">
              We'll email your confirmation. Add a phone number (optional) so we can text you if anything changes.
            </p>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              maxLength={32}
              placeholder="Phone (optional)"
              value={rsvpPhone}
              onChange={(e) => setRsvpPhone(e.target.value)}
              className="w-full bg-card border border-border rounded-md px-3 py-2 text-xs"
            />
            <button
              onClick={submitFreeRsvp}
              disabled={loading}
              className="btn-chrome w-full px-5 py-2 text-xs uppercase tracking-[0.2em] disabled:opacity-50"
            >
              {loading ? "Submitting…" : "Confirm RSVP"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventDetail;