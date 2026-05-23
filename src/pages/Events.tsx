import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
const sb = supabase as unknown as { from: (table: string) => any };
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Lock, X, ArrowRight } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { pickEventCard, type EventCardStyle } from "@/components/EventCard";
import TicketPass, { type TicketPassData } from "@/components/TicketPass";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import HCaptchaWidget from "@/components/HCaptchaWidget";
import EventsHeader from "@/components/EventsHeader";
import SiteFooter from "@/components/SiteFooter";

interface EventRow {
  id: string;
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
  is_public_teaser: boolean;
  card_style: EventCardStyle | null;
  refund_policy: string | null;
  slug: string | null;
}

interface HomepageSettings {
  hero_media_type: string;
  hero_media_url: string | null;
  hero_headline: string;
  hero_subheadline: string;
  hero_cta_text: string | null;
  hero_cta_link: string | null;
  hero_overlay_opacity: number;
  upcoming_heading: string;
  upcoming_subheading: string | null;
  upcoming_layout: string;
  upcoming_limit: number | null;
  past_heading: string;
  past_show: boolean;
  notify_show: boolean;
  notify_heading: string;
  notify_description: string;
  notify_button_text: string;
  notify_success_message: string;
  about_show: boolean;
  about_heading: string;
  about_body: string | null;
  about_address: string | null;
  about_hours: string | null;
  about_contact_email: string | null;
  about_contact_phone: string | null;
  faq_show: boolean;
  faq_heading: string;
  seo_title: string;
  seo_description: string | null;
  seo_og_image_url: string | null;
  seo_og_title: string | null;
  seo_og_description: string | null;
}

const Events = () => {
  const navigate = useNavigate();
  const { id: routeEventId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [counts, setCounts] = useState<Record<string, { confirmed: number; waitlist: number }>>({});
  const [user, setUser] = useState<{ email: string | null; id: string } | null>(null);
  const [myRsvps, setMyRsvps] = useState<Record<string, { id: string; status: string; payment_status: string }>>({});
  const [loading, setLoading] = useState(false);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState<Record<string, string>>({});
  const [notifySubmitting, setNotifySubmitting] = useState<Record<string, boolean>>({});
  const [notifyDone, setNotifyDone] = useState<Record<string, boolean>>({});
  const [notifyCaptchaToken, setNotifyCaptchaToken] = useState<string | null>(null);
  const [notifyCaptchaForEvent, setNotifyCaptchaForEvent] = useState<string | null>(null);
  const [purchasedTicket, setPurchasedTicket] = useState<TicketPassData | null>(null);
  const [hp, setHp] = useState<HomepageSettings | null>(null);
  const [hpGallery, setHpGallery] = useState<{ id: string; image_url: string; caption: string | null }[]>([]);
  const [hpFaqs, setHpFaqs] = useState<{ id: string; question: string; answer: string }[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: g }, { data: f }] = await Promise.all([
        sb.from("events_homepage_settings").select("*").eq("id", 1).maybeSingle(),
        sb.from("events_homepage_gallery").select("*").order("sort_order", { ascending: true }),
        sb.from("events_homepage_faqs").select("*").order("sort_order", { ascending: true }),
      ]);
      if (s) setHp(s as HomepageSettings);
      if (g) setHpGallery(g as { id: string; image_url: string; caption: string | null }[]);
      if (f) setHpFaqs(f as { id: string; question: string; answer: string }[]);
    })();
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUser({ email: session.user.email || null, id: session.user.id });
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ? { email: session.user.email || null, id: session.user.id } : null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("events")
        .select("*")
        .gte("event_date", today)
        .in("status", ["published", "draft"])
        .is("archived_at", null)
        .order("sort_order", { ascending: true })
        .order("event_date", { ascending: true });
      const list = (data as EventRow[]) || [];
      setEvents(list);

      const c: Record<string, { confirmed: number; waitlist: number }> = {};
      await Promise.all(list.map(async (e) => {
        const { data: a } = await supabase.rpc("get_event_attendance", { p_event_id: e.id });
        const x = (a as { confirmed_count?: number; waitlist_count?: number } | null) || {};
        c[e.id] = { confirmed: x.confirmed_count || 0, waitlist: x.waitlist_count || 0 };
      }));
      setCounts(c);

      if (user?.email) {
        const { data: rs } = await supabase
          .from("event_rsvps")
          .select("id, event_id, status, payment_status")
          .ilike("user_email", user.email);
        const map: Record<string, { id: string; status: string; payment_status: string }> = {};
        (rs || []).forEach((r) => { map[r.event_id] = { id: r.id, status: r.status, payment_status: r.payment_status }; });
        setMyRsvps(map);
      }
      setEventsLoaded(true);
    };
    load();
  }, [user?.email]);

  const handleRsvp = async (event: EventRow) => {
    if (!user?.email) {
      navigate(`/auth?redirect=/events`);
      return;
    }
    setLoading(true);
    try {
      const c = counts[event.id] || { confirmed: 0, waitlist: 0 };
      const isFull = c.confirmed >= event.capacity;

      if (event.price_cents > 0 && !isFull) {
        // Paid checkout — attach host referral token if buyer arrived via /sell/:token
        let referringHostToken: string | null = null;
        try {
          referringHostToken = sessionStorage.getItem("rc_host_referral_token");
        } catch {
          /* storage may be disabled */
        }
        const { data, error } = await supabase.functions.invoke("create-event-ticket-payment", {
          body: {
            eventId: event.id,
            customerName: user.email.split("@")[0],
            customerEmail: user.email,
            referringHostToken,
          },
        });
        if (error) throw error;
        if (data?.url) window.location.href = data.url;
        return;
      }

      // Free RSVP or waitlist
      const status = isFull ? "waitlist" : "confirmed";
      const { error } = await supabase
        .from("event_rsvps")
        .insert({
          event_id: event.id,
          user_id: user.id,
          user_email: user.email,
          user_name: user.email.split("@")[0],
          status,
          payment_status: "free",
        });
      if (error) throw error;

      toast({
        title: status === "waitlist" ? "Added to waitlist" : "You're in!",
        description: status === "waitlist" ? "We'll email you if a spot opens." : "Confirmation email on the way.",
      });

      let newRsvpId: string | undefined;
      if (status === "confirmed") {
        const { data: rsvp } = await supabase
          .from("event_rsvps")
          .select("id")
          .eq("event_id", event.id)
          .ilike("user_email", user.email)
          .maybeSingle();
        if (rsvp?.id) {
          newRsvpId = rsvp.id;
          await supabase.functions.invoke("send-event-confirmation", { body: { rsvpId: rsvp.id } });
        }
      }

      // Refresh
      setMyRsvps({ ...myRsvps, [event.id]: { id: newRsvpId || "", status, payment_status: "free" } });
      setCounts({
        ...counts,
        [event.id]: {
          confirmed: status === "confirmed" ? c.confirmed + 1 : c.confirmed,
          waitlist: status === "waitlist" ? c.waitlist + 1 : c.waitlist,
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      toast({ title: "RSVP failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Handle Stripe success / cancel returns
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
          toast({ title: "🎟️ Ticket confirmed!", description: "Check your email for your ticket and calendar invite." });
          const { data: rsvpRow } = await supabase
            .from("event_rsvps")
            .select("id, ticket_code, user_name, status, payment_status, amount_paid_cents, events(*)")
            .eq("id", rsvpId)
            .maybeSingle();
          if (rsvpRow && rsvpRow.ticket_code && rsvpRow.events) {
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

  const handleCancelRsvp = async (event: EventRow) => {
    const mine = myRsvps[event.id];
    if (!mine?.id || !user?.email) return;
    if (!confirm("Cancel your RSVP for this event?")) return;
    setLoading(true);
    try {
      const wasConfirmed = mine.status === "confirmed";
      const { error } = await supabase
        .from("event_rsvps")
        .update({ status: "cancelled" })
        .eq("id", mine.id);
      if (error) throw error;

      // Auto-promote next waitlister if a confirmed seat opened
      if (wasConfirmed) {
        await supabase.functions.invoke("process-event-waitlist", { body: { eventId: event.id } });
      }

      toast({ title: "RSVP cancelled", description: wasConfirmed ? "Your seat has been released." : "You're off the waitlist." });
      setMyRsvps({ ...myRsvps, [event.id]: { ...mine, status: "cancelled" } });
      const c = counts[event.id] || { confirmed: 0, waitlist: 0 };
      setCounts({
        ...counts,
        [event.id]: {
          confirmed: wasConfirmed ? Math.max(0, c.confirmed - 1) : c.confirmed,
          waitlist: !wasConfirmed ? Math.max(0, c.waitlist - 1) : c.waitlist,
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      toast({ title: "Cancel failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleNotifyMe = async (eventId: string) => {
    const raw = (notifyEmail[eventId] || user?.email || "").trim();
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(raw) || raw.length > 255) {
      toast({ title: "Enter a valid email", variant: "destructive" });
      return;
    }
    if (!notifyCaptchaToken || notifyCaptchaForEvent !== eventId) {
      setNotifyCaptchaForEvent(eventId);
      toast({ title: "Complete the captcha below to continue", variant: "destructive" });
      return;
    }
    setNotifySubmitting({ ...notifySubmitting, [eventId]: true });
    try {
      // Verify captcha server-side first
      const { data: captchaResult, error: captchaError } = await supabase.functions.invoke("verify-captcha", {
        body: { token: notifyCaptchaToken },
      });
      if (captchaError || !captchaResult?.success) {
        toast({ title: "Captcha verification failed", description: "Please try again.", variant: "destructive" });
        setNotifyCaptchaToken(null);
        setNotifySubmitting({ ...notifySubmitting, [eventId]: false });
        return;
      }

      const { error } = await supabase
        .from("event_notify_signups")
        .insert({ event_id: eventId, email: raw.toLowerCase() });
      if (error && !/duplicate|unique/i.test(error.message)) throw error;
      setNotifyDone({ ...notifyDone, [eventId]: true });
      setNotifyCaptchaToken(null);
      setNotifyCaptchaForEvent(null);
      toast({ title: "You're on the list", description: "We'll email you the moment tickets open." });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      toast({ title: "Signup failed", description: msg, variant: "destructive" });
    } finally {
      setNotifySubmitting({ ...notifySubmitting, [eventId]: false });
    }
  };
  // Scroll to a specific event when /events/:id
  useEffect(() => {
    if (!routeEventId || events.length === 0) return;
    const el = document.getElementById(`event-${routeEventId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [routeEventId, events]);

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{hp?.seo_title || "Replay Club Events"}</title>
        {hp?.seo_description && <meta name="description" content={hp.seo_description} />}
        <meta property="og:title" content={hp?.seo_og_title || hp?.seo_title || "Replay Club Events"} />
        {hp?.seo_og_description && <meta property="og:description" content={hp.seo_og_description} />}
        {hp?.seo_og_image_url && <meta property="og:image" content={hp.seo_og_image_url} />}
      </Helmet>
      <EventsHeader
        subNav={[
          { id: "upcoming", label: "Upcoming" },
          ...(hp?.past_show && hpGallery.length > 0 ? [{ id: "past", label: "Past" }] : []),
          ...(hp?.notify_show ? [{ id: "subscribe", label: "​" }] : []),
          ...(hp?.faq_show && hpFaqs.length > 0 ? [{ id: "faq", label: "FAQ" }] : []),
        ]}
      />

      {/* ─── HERO ─────────────────────────────────────────────────────────
         Full-width destination hero. Uses chrome typography + admin-supplied
         media as the background. Reads "Events · Replay Club" so users
         immediately know they've entered a dedicated section. */}
      <section className="relative overflow-hidden border-b border-border/30">
        {hp?.hero_media_url && hp.hero_media_type === "image" && (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${hp.hero_media_url})` }}
            aria-hidden
          />
        )}
        {hp?.hero_media_url && hp.hero_media_type === "video" && (
          <video
            src={hp.hero_media_url}
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
            aria-hidden
          />
        )}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 0%, hsl(var(--chrome-light) / 0.10), transparent 55%), radial-gradient(circle at 50% 100%, hsl(var(--background)) 30%, transparent 80%)",
          }}
        />
        {hp?.hero_media_url && (
          <div
            className="absolute inset-0 bg-background"
            style={{ opacity: (hp.hero_overlay_opacity ?? 40) / 100 }}
            aria-hidden
          />
        )}
        <div className="relative container mx-auto max-w-4xl px-4 py-16 sm:py-24 text-center">
          <p className="font-display text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.45em] text-muted-foreground mb-4">
            ​
          </p>
          <h1 className="font-display text-4xl sm:text-6xl md:text-7xl font-bold uppercase tracking-tight chrome-text leading-[0.95] mb-4">
            {hp?.hero_headline || "Events"}
          </h1>
          <div className="mx-auto h-px w-16 bg-gradient-to-r from-transparent via-chrome to-transparent mb-5" />
          <p className="text-muted-foreground text-sm sm:text-base font-body max-w-xl mx-auto leading-relaxed">
            {hp?.hero_subheadline || "Members-only experiences at Replay Club."}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {hp?.hero_cta_text && hp?.hero_cta_link && (
              <a
                href={hp.hero_cta_link}
                className="inline-flex items-center gap-1.5 chrome-btn font-display font-semibold text-xs uppercase tracking-[0.18em] px-5 py-2.5 rounded-md"
              >
                {hp.hero_cta_text} <ArrowRight className="w-3.5 h-3.5" />
              </a>
            )}
            {!user && (
              <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-body">
                <Lock className="w-3 h-3" /> Sign in to RSVP
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="container mx-auto max-w-3xl px-4 py-10 space-y-12">
        {/* ── UPCOMING ── */}
        <section id="upcoming" className="scroll-mt-32 space-y-6">
          <div className="flex items-end justify-between gap-3 border-b border-border/40 pb-3">
            <div>
              <p className="font-display text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground mb-1">
                ​
              </p>
              <h2 className="font-display text-xl sm:text-2xl font-bold uppercase tracking-wider text-foreground">
                {hp?.upcoming_heading || "Upcoming Events"}
              </h2>
              {hp?.upcoming_subheading && (
                <p className="text-xs text-muted-foreground font-body mt-1">
                  {hp.upcoming_subheading}
                </p>
              )}
            </div>
          </div>

        {/* Loading skeleton — shown while events fetch from the database. */}
        {!eventsLoaded && (
          <div className="space-y-4" aria-busy="true" aria-live="polite">
            <span className="sr-only">Loading events…</span>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-xl p-5 animate-pulse"
              >
                <div className="flex gap-4">
                  <div className="h-16 w-16 rounded-xl bg-muted/40" />
                  <div className="flex-1 space-y-3">
                    <div className="h-4 w-2/3 rounded bg-muted/40" />
                    <div className="h-3 w-1/2 rounded bg-muted/30" />
                    <div className="h-3 w-1/3 rounded bg-muted/30" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {eventsLoaded && events.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-premium relative overflow-hidden p-10 md:p-14 text-center"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-60"
              style={{
                background:
                  "radial-gradient(circle at 50% 0%, hsl(var(--chrome-light) / 0.12), transparent 60%), radial-gradient(circle at 50% 100%, hsl(var(--accent) / 0.10), transparent 55%)",
              }}
            />
            <div className="relative space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/40 px-3 py-1">
                <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-body">
                  Nothing on the calendar
                </span>
              </div>
              <h3 className="chrome-text font-display text-2xl md:text-3xl tracking-tight">
                No upcoming events
              </h3>
              <p className="text-muted-foreground text-sm md:text-base font-body max-w-md mx-auto leading-relaxed">
                Subscribe to be notified the moment the next show drops.
              </p>
            </div>
          </motion.div>
        )}

        <div
          className={
            hp?.upcoming_layout === "grid"
              ? "grid grid-cols-1 sm:grid-cols-2 gap-4"
              : "space-y-4"
          }
        >
        {(hp?.upcoming_limit ? events.slice(0, hp.upcoming_limit) : events).map((e, i) => {
          const c = counts[e.id] || { confirmed: 0, waitlist: 0 };
          const isFull = c.confirmed >= e.capacity;
          const mine = myRsvps[e.id];
          const isHighlighted = routeEventId === e.id;

          const isDraft = e.status === "draft";
          const priceHidden = e.show_price === false;
          const showNotify = isDraft || priceHidden;
          const submitted = !!notifyDone[e.id];
          const submitting = !!notifySubmitting[e.id];

          const cta = showNotify ? (
            submitted ? (
              <div className="text-center py-2.5 px-3 rounded-md bg-card border border-border/40 text-xs font-display uppercase tracking-wider text-muted-foreground">
                ✓ You'll be notified
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-mono text-center">
                  {isDraft ? "Tickets not live yet — get notified" : "Tickets coming soon — get notified when they go on sale"}
                </p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    maxLength={255}
                    placeholder={user?.email || "you@email.com"}
                    value={notifyEmail[e.id] ?? (user?.email || "")}
                    onChange={(ev) => setNotifyEmail({ ...notifyEmail, [e.id]: ev.target.value })}
                    className="flex-1 min-w-0 bg-card border border-border rounded-md px-3 py-2 text-xs"
                  />
                  <button
                    onClick={() => handleNotifyMe(e.id)}
                    disabled={submitting}
                    className="chrome-btn shrink-0 px-3 py-2 rounded-md text-[11px] font-display uppercase tracking-wider font-semibold disabled:opacity-50"
                  >
                    {submitting ? "…" : "Notify Me"}
                  </button>
                </div>
                {notifyCaptchaForEvent === e.id && !notifyCaptchaToken && (
                  <HCaptchaWidget
                    onVerify={(token) => setNotifyCaptchaToken(token)}
                    onExpire={() => setNotifyCaptchaToken(null)}
                  />
                )}
              </div>
            )
          ) : !user ? (
            <button
              onClick={() => navigate(`/auth?redirect=/events`)}
              className="chrome-btn-outline w-full py-2.5 rounded-md text-xs font-display uppercase tracking-wider font-semibold"
            >
              Sign in to RSVP
            </button>
          ) : mine && mine.status !== "cancelled" ? (
            <div className="space-y-2">
              <div className="text-center py-2 px-3 rounded-md bg-card border border-border/40 text-xs font-display uppercase tracking-wider">
                {mine.status === "confirmed" && "✓ You're going"}
                {mine.status === "waitlist" && "⏳ On waitlist"}
                {mine.status === "pending_payment" && "💳 Payment pending"}
              </div>
              {mine.status === "pending_payment" && (
                <button
                  onClick={() => handleRsvp(e)}
                  disabled={loading}
                  className="chrome-btn w-full py-2 rounded-md text-[11px] font-display uppercase tracking-wider font-semibold disabled:opacity-50"
                >
                  Complete Payment
                </button>
              )}
              <button
                onClick={() => handleCancelRsvp(e)}
                disabled={loading}
                className="w-full py-2 rounded-md text-[10px] font-body text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <X className="w-3 h-3" /> Cancel RSVP
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleRsvp(e)}
              disabled={loading}
              className="chrome-btn w-full py-2.5 rounded-md text-xs font-display uppercase tracking-wider font-semibold disabled:opacity-50"
            >
              {isFull
                ? "Join Waitlist"
                : e.price_cents > 0
                ? `Buy Ticket — $${(e.price_cents / 100).toFixed(2)}`
                : "RSVP"}
            </button>
          );

          // Card style is admin-selectable per event (defaults to glass_chrome)
          const Card = pickEventCard(e.card_style);

          return (
            <motion.div
              key={e.id}
              id={`event-${e.id}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card event={e} confirmed={c.confirmed} isHighlighted={isHighlighted}>
                {cta}
                {e.refund_policy && (
                  <div className="mt-3 pt-3 border-t border-border/30">
                    <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-mono mb-1">Refund Policy</p>
                    <p className="text-[11px] text-muted-foreground font-body leading-relaxed whitespace-pre-wrap">{e.refund_policy}</p>
                  </div>
                )}
                <div className="mt-3 pt-3 border-t border-border/30 text-center">
                  <button
                    onClick={() => navigate(`/events/${e.slug || e.id}`)}
                    className="inline-flex items-center gap-1.5 text-[10px] font-display uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    View details <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </Card>
            </motion.div>
          );
        })}
        </div>
        </section>

        {/* ── PAST EVENTS / GALLERY ── */}
        {hp?.past_show && hpGallery.length > 0 && (
          <section id="past" className="scroll-mt-32 space-y-4">
            <div className="border-b border-border/40 pb-3">
              <p className="font-display text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground mb-1">
                ​
              </p>
              <h2 className="font-display text-xl sm:text-2xl font-bold uppercase tracking-wider text-foreground">
                {hp.past_heading}
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {hpGallery.map((g) => (
                <figure key={g.id} className="rounded overflow-hidden border border-border/40 bg-card/30">
                  <img src={g.image_url} alt={g.caption || "Event photo"} loading="lazy" className="w-full h-32 object-cover" />
                  {g.caption && (
                    <figcaption className="p-1.5 text-[10px] text-muted-foreground font-body">{g.caption}</figcaption>
                  )}
                </figure>
              ))}
            </div>
          </section>
        )}

        {/* ── SUBSCRIBE / NEWSLETTER ── */}
        {hp?.notify_show && (
          <section id="subscribe" className="scroll-mt-32 card-premium p-6 sm:p-8 text-center space-y-3">
            <p className="font-display text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              ​
            </p>
            <h2 className="font-display text-xl sm:text-2xl font-bold uppercase tracking-wider text-foreground">
              {hp.notify_heading}
            </h2>
            <p className="text-sm text-muted-foreground font-body max-w-md mx-auto">{hp.notify_description}</p>
            <form
              onSubmit={async (ev) => {
                ev.preventDefault();
                const form = ev.currentTarget as HTMLFormElement;
                const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim();
                const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRe.test(email)) {
                  toast({ title: "Enter a valid email", variant: "destructive" });
                  return;
                }
                const { error } = await supabase
                  .from("event_notify_signups")
                  .insert({ event_id: events[0]?.id || "00000000-0000-0000-0000-000000000000", email: email.toLowerCase() });
                if (error && !/duplicate|unique/i.test(error.message)) {
                  toast({ title: "Signup failed", description: error.message, variant: "destructive" });
                  return;
                }
                form.reset();
                toast({ title: "Subscribed", description: hp.notify_success_message });
              }}
              className="flex gap-2 max-w-sm mx-auto pt-2"
            >
              <input
                type="email"
                name="email"
                required
                placeholder="you@email.com"
                maxLength={255}
                className="flex-1 bg-background border border-border/50 rounded px-3 py-2 text-sm"
              />
              <button type="submit" className="chrome-btn font-display font-semibold text-xs uppercase tracking-wider px-4 rounded">
                {hp.notify_button_text}
              </button>
            </form>
          </section>
        )}

        {/* ── ABOUT / VENUE ── */}
        {hp?.about_show && (hp.about_body || hp.about_address || hp.about_hours) && (
          <section id="about" className="scroll-mt-32 card-premium p-6 space-y-3">
            <h2 className="font-display text-lg font-semibold uppercase tracking-wider text-foreground">
              {hp.about_heading}
            </h2>
            {hp.about_body && (
              <p className="text-sm text-muted-foreground font-body whitespace-pre-line">{hp.about_body}</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-muted-foreground font-body">
              {hp.about_address && (
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-foreground mb-1">Address</p>
                  <p>{hp.about_address}</p>
                </div>
              )}
              {hp.about_hours && (
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-foreground mb-1">Hours</p>
                  <p className="whitespace-pre-line">{hp.about_hours}</p>
                </div>
              )}
              {hp.about_contact_email && (
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-foreground mb-1">Email</p>
                  <a href={`mailto:${hp.about_contact_email}`} className="hover:text-foreground">{hp.about_contact_email}</a>
                </div>
              )}
              {hp.about_contact_phone && (
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-foreground mb-1">Phone</p>
                  <a href={`tel:${hp.about_contact_phone}`} className="hover:text-foreground">{hp.about_contact_phone}</a>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── FAQ ── */}
        {hp?.faq_show && hpFaqs.length > 0 && (
          <section id="faq" className="scroll-mt-32 space-y-4">
            <div className="border-b border-border/40 pb-3">
              <p className="font-display text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground mb-1">
                ​
              </p>
              <h2 className="font-display text-xl sm:text-2xl font-bold uppercase tracking-wider text-foreground">
                {hp.faq_heading}
              </h2>
            </div>
            <div className="space-y-2">
              {hpFaqs.map((f) => (
                <details key={f.id} className="card-premium p-4 group">
                  <summary className="cursor-pointer font-display text-sm font-semibold tracking-wider text-foreground list-none flex justify-between items-center">
                    <span>{f.question}</span>
                    <span className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-2 text-sm text-muted-foreground font-body whitespace-pre-line">{f.answer}</p>
                </details>
              ))}
            </div>
          </section>
        )}
      </div>

      <SiteFooter />

      <Dialog open={!!purchasedTicket} onOpenChange={(open) => !open && setPurchasedTicket(null)}>
        <DialogContent className="max-w-md bg-background border-border">
          <DialogHeader>
            <DialogTitle className="font-display chrome-text text-center">Your Ticket is Ready</DialogTitle>
          </DialogHeader>
          {purchasedTicket && <TicketPass ticket={purchasedTicket} showWalletSave />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Events;
