import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Menu,
  ArrowLeft,
  Home,
  Music,
  Mic,
  Radio,
  Camera,
  Image as ImageIcon,
  Calendar,
  Gift,
  Users,
  UserPlus,
  User,
  Shield,
  FileText,
  Type,
  Minus,
  Plus,
  LogOut,
  RotateCcw,
  Bell,
  Sparkles,
  Trophy,
  HelpCircle,
  Scale,
  ScrollText,
  ShieldAlert,
  ChevronDown,
  Disc3,
  Headphones,
  ShoppingBag,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { haptic } from "@/lib/haptics";
import { useUserMenuData, serviceToRoute } from "@/hooks/useUserMenuData";
import SessionRecordBadge from "@/components/SessionRecordBadge";

type FontSize = "sm" | "md" | "lg" | "xl";

// Scale factors are viewport-aware so mobile, tablet, and desktop all stay
// proportionate. On small screens we use gentler scaling to avoid breaking
// horizontal layouts; large desktops get a wider range for visual impact.
const getScaleMap = (): Record<FontSize, number> => {
  if (typeof window === "undefined") {
    return { sm: 0.95, md: 1.0, lg: 1.1, xl: 1.2 };
  }
  const w = window.innerWidth;
  if (w < 640) {
    // Mobile — keep tight to avoid horizontal overflow
    return { sm: 0.92, md: 1.0, lg: 1.08, xl: 1.15 };
  }
  if (w < 1024) {
    // Tablet
    return { sm: 0.92, md: 1.0, lg: 1.1, xl: 1.2 };
  }
  // Desktop / Mac
  return { sm: 0.9, md: 1.0, lg: 1.12, xl: 1.25 };
};

const SIZE_ORDER: FontSize[] = ["sm", "md", "lg", "xl"];

const STORAGE_KEY = "rc:font-size";

const BASE_FONT_PX = 16;

const applyFontSize = (size: FontSize) => {
  const scale = getScaleMap()[size];
  // Scale the root font-size — every Tailwind rem-based class (text-sm, text-base, etc.)
  // and rem spacing reacts immediately. Works reliably across iOS Safari, Android, and desktop
  // (unlike CSS `zoom`, which is unsupported on Firefox and partial on Safari).
  document.documentElement.style.fontSize = `${BASE_FONT_PX * scale}px`;
  // Belt-and-suspenders: many internal classes use hardcoded pixel sizes
  // (e.g. `text-[10px]`, `text-[11px]`) that DON'T react to root font-size.
  // Apply CSS `zoom` to <body> so px-based UI scales proportionally too.
  // `zoom` is supported on Chromium, Safari 17+, and Firefox 126+. Older
  // Firefox simply ignores it — rem-based text still scales via font-size.
  if (typeof document !== "undefined" && document.body) {
    document.body.style.zoom = String(scale);
  }
};

// Studios sub-items live under the collapsible "Studios" parent below.
const studiosChildren = [
  { label: "Music", to: "/music-studio", icon: Music },
  { label: "Disk Jockey", to: "/dj-studio", icon: Disc3 },
  { label: "Podcast", to: "/podcast-studio", icon: Mic },
  { label: "Livestream", to: "/livestream-studio", icon: Radio },
  { label: "Backdrops", to: "/?tab=Backdrops", icon: ImageIcon },
];

// Top-level Explore items in the order requested.
// Studios is rendered separately as a collapsible parent.
const categories = [
  { label: "Home", to: "/", icon: Home },
  { label: "Events", to: "/events", icon: Calendar },
  { label: "Equipment Rental", to: "/equipment-rental", icon: Camera },
  { label: "Join Roster", to: "/join-roster", icon: UserPlus },
  { label: "Talent Roster", to: "/?tab=Talent", icon: Users },
  { label: "Gift Cards", to: "/gift-cards", icon: Gift },
  { label: "Shop", to: "/shop", icon: ShoppingBag },
];

const baseAccountLinks = [
  { label: "My Profile", to: "/profile", icon: User },
];

const legalLinks = [
  { label: "Studio Policies", to: "/policies", icon: ScrollText },
  { label: "Cancellation Policy", to: "/cancellation", icon: Scale },
  { label: "Code of Conduct", to: "/conduct", icon: ShieldAlert },
  { label: "Privacy Policy", to: "/privacy-policy", icon: FileText },
  { label: "Entry Terms", to: "/entry-terms", icon: FileText },
];

// Surfaced near the top of the menu so first-time visitors find the
// explainer before policy fine print. Lives above "Explore" categories.
const learnLinks = [
  { label: "How It Works", to: "/how-it-works", icon: HelpCircle },
];

// Time-aware greeting — uses local clock so it stays correct across TZs.
const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Good night";
};


const SiteMenu = () => {
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState<FontSize>("md");
  const [isAuthed, setIsAuthed] = useState(false);
  const [profile, setProfile] = useState<{ name: string; email: string; avatarUrl: string | null } | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const menuData = useUserMenuData(isAuthed && profile ? profile.email : null);
  // Auto-open Studios group when the user is on one of its child routes.
  const studiosActive = studiosChildren.some((s) => location.pathname.startsWith(s.to));
  const [studiosOpen, setStudiosOpen] = useState(studiosActive);
  useEffect(() => {
    if (studiosActive) setStudiosOpen(true);
  }, [studiosActive]);

  useEffect(() => {
    const loadProfile = async (userId: string, email: string) => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", userId)
        .maybeSingle();
      setProfile({
        name: data?.display_name || email.split("@")[0] || "Account",
        email,
        avatarUrl: data?.avatar_url ?? null,
      });
    };

    supabase.auth.getSession().then(({ data }) => {
      const session = data.session;
      setIsAuthed(!!session);
      if (session?.user) loadProfile(session.user.id, session.user.email ?? "");
      else setProfile(null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthed(!!session);
      if (session?.user) {
        // Defer to avoid deadlocks inside the auth callback
        setTimeout(() => loadProfile(session.user.id, session.user.email ?? ""), 0);
      } else {
        setProfile(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    setOpen(false);
    try {
      await supabase.auth.signOut();
      toast({ title: "Signed out" });
    } catch {
      toast({ title: "Sign out failed", variant: "destructive" });
    }
  };

  const isActive = (to: string) =>
    to === "/" ? location.pathname === "/" : location.pathname === to || location.pathname.startsWith(to + "/");

  const linkClass = (to: string) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-body transition-colors border ${
      isActive(to)
        ? "bg-secondary text-foreground border-border/60 chrome-text font-semibold"
        : "text-foreground/90 border-transparent hover:bg-secondary hover:text-foreground"
    }`;

  const iconClass = (to: string) =>
    `h-4 w-4 ${isActive(to) ? "text-foreground" : "text-muted-foreground"}`;

  // Load persisted size on mount and reapply on viewport resize so the
  // scale tier (mobile / tablet / desktop) stays correct when rotating
  // or resizing.
  useEffect(() => {
    let current: FontSize = "md";
    try {
      const saved = (localStorage.getItem(STORAGE_KEY) as FontSize) || "md";
      if (SIZE_ORDER.includes(saved)) current = saved;
    } catch {
      // ignore
    }
    setSize(current);
    applyFontSize(current);

    const onResize = () => {
      try {
        const s = (localStorage.getItem(STORAGE_KEY) as FontSize) || "md";
        applyFontSize(SIZE_ORDER.includes(s) ? s : "md");
      } catch {
        applyFontSize("md");
      }
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  const changeSize = (next: FontSize) => {
    setSize(next);
    applyFontSize(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  const stepSize = (dir: 1 | -1) => {
    const idx = SIZE_ORDER.indexOf(size);
    const nextIdx = Math.min(SIZE_ORDER.length - 1, Math.max(0, idx + dir));
    changeSize(SIZE_ORDER[nextIdx]);
  };

  const canGoBack = typeof window !== "undefined" && window.history.length > 1;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {/* z-[51] sits ABOVE the home page's fixed top nav (z-50) so the
          hamburger is visible on /, while Radix Dialog overlays (also z-50)
          still cover it because they portal to the end of <body> and the
          dialog content uses higher stacking. The collapsed trigger is
          additionally hidden via the `open` flag whenever the sheet itself
          is open, and BookingModal/AlertDialog overlays sit above this. */}
      <div className={`fixed top-3 left-3 z-[51] flex items-center gap-2 ${open ? 'hidden' : ''}`}>
        <SheetTrigger asChild>
          <button
            aria-label="Open menu"
            onClick={() => haptic(8)}
            className="relative h-11 w-11 sm:h-9 sm:w-9 flex items-center justify-center rounded-full border border-border/50 hover:border-chrome/60 bg-card/40 hover:bg-card/70 backdrop-blur-sm text-muted-foreground hover:text-foreground transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Menu className="h-5 w-5" strokeWidth={2} />
            {isAuthed && menuData.unreadNotifications > 0 && (
              <span
                aria-label={`${menuData.unreadNotifications} unread notifications`}
                className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-background"
              />
            )}
          </button>
        </SheetTrigger>
        {canGoBack && location.pathname !== "/" && (
          <button
            type="button"
            aria-label="Go back"
            onClick={() => window.history.back()}
            className="h-11 w-11 sm:h-9 sm:w-9 flex items-center justify-center rounded-full border border-border/50 hover:border-chrome/60 bg-card/40 hover:bg-card/70 backdrop-blur-sm text-muted-foreground hover:text-foreground transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
      </div>

      <SheetContent
        side="left"
        className="w-[300px] sm:w-[340px] bg-background/95 backdrop-blur-xl border-r border-border/50 p-0 flex flex-col"
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/40">
          <SheetTitle className="font-display chrome-text text-left tracking-[0.15em] uppercase text-sm">
            Replay Club
          </SheetTitle>
          {isAuthed && profile && (
            <Link
              to="/profile"
              onClick={() => { haptic(8); setOpen(false); }}
              className="mt-3 flex items-center gap-3 rounded-lg border border-border/40 bg-secondary/40 px-3 py-2 hover:bg-secondary transition-colors"
            >
              <Avatar className="h-10 w-10 border border-chrome/40">
                {profile.avatarUrl && <AvatarImage src={profile.avatarUrl} alt={profile.name} />}
                <AvatarFallback className="bg-background text-foreground text-xs font-mono uppercase">
                  {profile.name.slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-mono">
                  {getGreeting()}
                </p>
                <p className="text-sm font-body text-foreground truncate">{profile.name}</p>
              </div>
              {menuData.unreadNotifications > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-destructive/15 border border-destructive/40 px-2 py-0.5 text-[10px] font-mono text-destructive">
                  <Bell className="h-3 w-3" />
                  {menuData.unreadNotifications}
                </span>
              )}
            </Link>
          )}
          {!isAuthed && (
            <p className="mt-2 text-[11px] text-muted-foreground font-body">
              {getGreeting()} — sign in to track bookings & rewards.
            </p>
          )}
        </SheetHeader>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {/* Resume abandoned checkout */}
          {isAuthed && menuData.abandoned && (
            <button
              type="button"
              onClick={() => {
                haptic(12);
                setOpen(false);
                navigate(serviceToRoute(menuData.abandoned!.service));
              }}
              className="mx-1 mb-2 w-[calc(100%-0.5rem)] flex items-center gap-2 rounded-md border border-chrome/40 bg-gradient-to-r from-secondary/60 to-secondary/20 px-3 py-2 text-left hover:border-chrome/70 transition-all"
            >
              <Sparkles className="h-3.5 w-3.5 text-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-mono">Resume</p>
                <p className="text-xs text-foreground truncate">Finish your {menuData.abandoned.service} booking</p>
              </div>
            </button>
          )}

          {/* One-tap rebook */}
          {isAuthed && menuData.lastBooking && !menuData.abandoned && (
            <button
              type="button"
              onClick={() => {
                haptic(12);
                setOpen(false);
                navigate(serviceToRoute(menuData.lastBooking!.service || menuData.lastBooking!.roomTitle));
              }}
              className="mx-1 mb-2 w-[calc(100%-0.5rem)] flex items-center gap-2 rounded-md border border-border/40 bg-secondary/30 px-3 py-2 text-left hover:bg-secondary transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-mono">Rebook</p>
                <p className="text-xs text-foreground truncate">{menuData.lastBooking.roomTitle}</p>
              </div>
            </button>
          )}

          {/* Loyalty progress */}
          {isAuthed && !menuData.loading && (
            <button
              type="button"
              onClick={() => {
                haptic(10);
                setOpen(false);
                navigate("/profile?tab=profile&scrollTo=tier");
              }}
              aria-label={`View ${menuData.tierInfo.tier} tier details`}
              className="mx-1 mb-3 w-[calc(100%-0.5rem)] flex items-center gap-3 rounded-md border border-border/40 bg-secondary/30 px-3 py-2.5 text-left hover:bg-secondary hover:border-chrome/60 transition-all"
            >
              {/* Compact vinyl — disable internal popover by wrapping in a non-interactive div */}
              <div className="shrink-0 pointer-events-none">
                <SessionRecordBadge
                  tier={menuData.tierInfo.tier}
                  bookingCount={menuData.bookingCount}
                  sessionsToNext={menuData.tierInfo.sessionsToNext}
                  nextTier={menuData.tierInfo.nextTier}
                  size={44}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-foreground font-display font-semibold truncate">
                    {menuData.tierInfo.tier}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                    {menuData.bookingCount} {menuData.bookingCount === 1 ? "session" : "sessions"}
                  </span>
                </div>
                <div className="h-1 w-full rounded-full bg-background/60 overflow-hidden">
                  <div
                    className="h-full bg-foreground transition-all duration-500"
                    style={{ width: `${menuData.progressPct}%` }}
                  />
                </div>
                {menuData.nextTier ? (
                  <p className="mt-1.5 text-[9px] text-muted-foreground/80 font-mono truncate">
                    {menuData.tierInfo.sessionsToNext} more to {menuData.nextTier.name}
                  </p>
                ) : (
                  <p className="mt-1.5 text-[9px] text-muted-foreground/80 font-mono truncate">
                    Top tier unlocked
                  </p>
                )}
              </div>
            </button>
          )}

          {/* Main categories */}
          <div className="mb-2">
            <p className="px-3 py-2 text-[9px] uppercase tracking-[0.25em] text-muted-foreground/70 font-mono">
              Learn
            </p>
            <ul className="space-y-0.5 mb-3">
              {learnLinks.map((c) => {
                const Icon = c.icon;
                const active = isActive(c.to);
                return (
                  <li key={c.to}>
                    <Link
                      to={c.to}
                      onClick={() => { haptic(8); setOpen(false); }}
                      aria-current={active ? "page" : undefined}
                      className={linkClass(c.to)}
                    >
                      <Icon className={iconClass(c.to)} />
                      <span className="flex-1">{c.label}</span>
                      {active && <span className="h-1.5 w-1.5 rounded-full bg-foreground shadow-[0_0_8px_hsl(var(--foreground))]" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <p className="px-3 py-2 text-[9px] uppercase tracking-[0.25em] text-muted-foreground/70 font-mono">
              Explore
            </p>
            <ul className="space-y-0.5">
              {categories.map((c, idx) => {
                const Icon = c.icon;
                const active = isActive(c.to);
                return (
                  <React.Fragment key={c.to}>
                  <li>
                    <Link
                      to={c.to}
                      onClick={(e) => {
                        haptic(8);
                        setOpen(false);
                        // If the user clicks a category they're already on
                        // (e.g. "Home" while at "/"), the Link is a no-op —
                        // React Router won't fire any state change, so the
                        // page would just look frozen. Scroll to the top and
                        // for the homepage strip the ?tab= so the hero/orbit
                        // re-appears.
                        if (location.pathname === c.to.split("?")[0] &&
                            location.search === (c.to.includes("?") ? "?" + c.to.split("?")[1] : "")) {
                          e.preventDefault();
                          if (c.to === "/") {
                            // Force a state reset on the homepage by
                            // navigating to "/" without query params.
                            navigate("/", { replace: true });
                          }
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }
                      }}
                      aria-current={active ? "page" : undefined}
                      className={linkClass(c.to)}
                    >
                      <Icon className={iconClass(c.to)} />
                      <span className="flex-1">{c.label}</span>
                      {active && <span className="h-1.5 w-1.5 rounded-full bg-foreground shadow-[0_0_8px_hsl(var(--foreground))]" />}
                    </Link>
                  </li>
                  {/* Render the Studios collapsible group right after Home
                      so it lives between Home and the rest of Explore. */}
                  {idx === 0 && (
                    <li key="__studios__">
                      <button
                        type="button"
                        onClick={() => { haptic(8); setStudiosOpen((v) => !v); }}
                        aria-expanded={studiosOpen}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-body transition-colors border ${
                          studiosActive
                            ? "bg-secondary text-foreground border-border/60 chrome-text font-semibold"
                            : "text-foreground/90 border-transparent hover:bg-secondary hover:text-foreground"
                        }`}
                      >
                        <Headphones className={`h-4 w-4 ${studiosActive ? "text-foreground" : "text-muted-foreground"}`} />
                        <span className="flex-1 text-left">Studios</span>
                        <ChevronDown
                          className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${studiosOpen ? "rotate-180" : ""}`}
                        />
                      </button>
                      {studiosOpen && (
                        <ul className="mt-0.5 ml-3 pl-3 border-l border-border/40 space-y-0.5">
                          {studiosChildren.map((s) => {
                            const SIcon = s.icon;
                            const sActive = isActive(s.to);
                            return (
                              <li key={s.to}>
                                <Link
                                  to={s.to}
                                  onClick={() => { haptic(8); setOpen(false); }}
                                  aria-current={sActive ? "page" : undefined}
                                  className={linkClass(s.to)}
                                >
                                  <SIcon className={iconClass(s.to)} />
                                  <span className="flex-1">{s.label}</span>
                                  {sActive && <span className="h-1.5 w-1.5 rounded-full bg-foreground shadow-[0_0_8px_hsl(var(--foreground))]" />}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  )}
                  </React.Fragment>
                );
              })}
            </ul>
          </div>

          {/* Account */}
          <div className="mb-2 mt-4">
            <p className="px-3 py-2 text-[9px] uppercase tracking-[0.25em] text-muted-foreground/70 font-mono">
              Account
            </p>
            <ul className="space-y-0.5">
              {baseAccountLinks.map((c) => {
                const Icon = c.icon;
                const active = isActive(c.to);
                return (
                  <li key={c.to}>
                    <Link
                      to={c.to}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={linkClass(c.to)}
                    >
                      <Icon className={iconClass(c.to)} />
                      <span className="flex-1">{c.label}</span>
                      {active && <span className="h-1.5 w-1.5 rounded-full bg-foreground shadow-[0_0_8px_hsl(var(--foreground))]" />}
                    </Link>
                  </li>
                );
              })}
              {isAuthed ? (
                <li>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className={linkClass("/__signout") + " w-full text-left"}
                  >
                    <LogOut className={iconClass("/__signout")} />
                    <span className="flex-1">Sign Out</span>
                  </button>
                </li>
              ) : (
                <li>
                  <Link
                    to="/auth"
                    onClick={() => setOpen(false)}
                    aria-current={isActive("/auth") ? "page" : undefined}
                    className={linkClass("/auth")}
                  >
                    <Shield className={iconClass("/auth")} />
                    <span className="flex-1">Sign In</span>
                    {isActive("/auth") && <span className="h-1.5 w-1.5 rounded-full bg-foreground shadow-[0_0_8px_hsl(var(--foreground))]" />}
                  </Link>
                </li>
              )}
            </ul>
          </div>

          {/* Legal */}
          <div className="mb-2 mt-4">
            <p className="px-3 py-2 text-[9px] uppercase tracking-[0.25em] text-muted-foreground/70 font-mono">
              Legal
            </p>
            <ul className="space-y-0.5">
              {legalLinks.map((c) => {
                const Icon = c.icon;
                const active = isActive(c.to);
                return (
                  <li key={c.to}>
                    <Link
                      to={c.to}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={linkClass(c.to)}
                    >
                      <Icon className={iconClass(c.to)} />
                      <span className="flex-1">{c.label}</span>
                      {active && <span className="h-1.5 w-1.5 rounded-full bg-foreground shadow-[0_0_8px_hsl(var(--foreground))]" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        {/* Font size controls */}
        <div className="border-t border-border/40 px-4 py-4 bg-secondary/30">
          <div className="flex items-center gap-2 mb-3">
            <Type className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-mono">
              Text Size
            </p>
          </div>
          <div className="flex items-center justify-between gap-1.5">
            <Button
              variant="outline"
              size="icon"
              onClick={() => stepSize(-1)}
              disabled={size === SIZE_ORDER[0]}
              aria-label="Decrease text size"
              className="h-9 w-9 shrink-0 border-border/50"
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>

            <div className="flex-1 min-w-0 grid grid-cols-4 gap-1">
              {SIZE_ORDER.map((s) => (
                <button
                  key={s}
                  onClick={() => changeSize(s)}
                  aria-label={`Set text size ${s}`}
                  aria-pressed={size === s}
                  className={`py-2 px-0 rounded-md text-[10px] leading-none uppercase tracking-wider font-mono transition-all border whitespace-nowrap overflow-hidden ${
                    size === s
                      ? "bg-foreground text-background border-foreground"
                      : "bg-transparent text-muted-foreground border-border/40 hover:border-border hover:text-foreground"
                  }`}
                >
                  A
                  <span className="ml-0.5 opacity-60">
                    {s === "sm" ? "−" : s === "md" ? "" : s === "lg" ? "+" : "++"}
                  </span>
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => stepSize(1)}
              disabled={size === SIZE_ORDER[SIZE_ORDER.length - 1]}
              aria-label="Increase text size"
              className="h-9 w-9 shrink-0 border-border/50"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <p className="mt-3 text-[9px] text-muted-foreground/60 font-mono text-center tracking-wider">
            Saved automatically
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SiteMenu;
