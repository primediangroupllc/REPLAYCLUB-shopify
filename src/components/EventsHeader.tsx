import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, LogIn } from "lucide-react";
import logo from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";

interface SubNavItem {
  id: string;
  label: string;
}

interface EventsHeaderProps {
  /** Anchor IDs available on the page (e.g. #upcoming, #past, #subscribe). */
  subNav?: SubNavItem[];
}

/**
 * Header dedicated to the /events section.
 *
 * - Logo (left) → /
 * - Centered "EVENTS" wordmark with "REPLAY CLUB" eyebrow so users immediately
 *   understand they're inside the Events destination.
 * - Account/login (right).
 * - Sticky sub-navigation row below the top bar — Upcoming / Past / Subscribe.
 *   On mobile the row scrolls horizontally rather than collapsing to a
 *   hamburger because (a) only 2-4 anchors and (b) the global SiteMenu
 *   already provides a hamburger entry point top-left for the rest of the site.
 *
 * Active sub-nav state is computed via IntersectionObserver, so as you scroll
 * the section you're currently reading highlights.
 *
 * NOTE: The single back button is still rendered globally by SiteMenu, so we
 * intentionally do NOT mount one here.
 */
const EventsHeader = ({ subNav = [] }: EventsHeaderProps) => {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);
  const [active, setActive] = useState<string>(subNav[0]?.id ?? "");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Highlight the sub-nav item for whichever section is currently in view.
  useEffect(() => {
    if (subNav.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActive(visible.target.id);
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    subNav.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [subNav]);

  const handleNav = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      // Offset so the section heading isn't hidden under the sticky header.
      const top = el.getBoundingClientRect().top + window.scrollY - 120;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-xl border-b border-border/40">
      {/* Top bar */}
      <div className="relative container mx-auto px-4 py-3 flex items-center justify-between gap-3">
        {/* Logo (left) — back to homepage. SiteMenu's back button stays at very top-left. */}
        <Link
          to="/"
          aria-label="Replay Club home"
          className="relative z-10 flex items-center gap-2 transition-opacity hover:opacity-80 ml-12 sm:ml-14"
        >
          <img src={logo} alt="Replay Club" className="w-8 h-8 rounded-full object-cover" />
          <div className="hidden sm:flex flex-col leading-none">
            <span className="font-display text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              ​
            </span>
            <span className="font-display text-[11px] font-bold uppercase tracking-[0.3em] chrome-text mt-0.5">
              Events
            </span>
          </div>
        </Link>

        {/* Centered EVENTS wordmark */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none">
          <span className="font-display text-[9px] font-semibold uppercase tracking-[0.35em] text-muted-foreground hidden sm:block">
            ​
          </span>
          <span className="font-display text-base sm:text-lg font-bold uppercase tracking-[0.3em] chrome-text leading-none">
            Events
          </span>
        </div>

        {/* Account (right) */}
        <div className="relative z-10 flex items-center gap-2">
          {authed ? (
            <button
              onClick={() => navigate("/profile")}
              aria-label="My profile"
              className="h-9 w-9 inline-flex items-center justify-center rounded-full border border-border/50 bg-background/60 hover:bg-background hover:border-chrome/60 transition-colors"
            >
              <User className="h-4 w-4 text-foreground" />
            </button>
          ) : (
            <button
              onClick={() => navigate("/auth?redirect=/events")}
              className="inline-flex items-center gap-1.5 h-9 px-3 sm:px-4 rounded-full border border-border/50 bg-background/60 hover:bg-background hover:border-chrome/60 transition-colors text-[11px] sm:text-xs font-display font-semibold uppercase tracking-[0.18em] text-foreground"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign in</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-nav */}
      {subNav.length > 0 && (
        <nav
          aria-label="Events sections"
          className="border-t border-border/30 bg-background/60"
        >
          <div className="container mx-auto px-4">
            <ul className="flex items-center gap-1 overflow-x-auto scrollbar-hide -mx-1 px-1 py-2">
              {subNav.map((item) => {
                const isActive = active === item.id;
                return (
                  <li key={item.id} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => handleNav(item.id)}
                      aria-current={isActive ? "true" : undefined}
                      className={`relative inline-flex items-center px-3 sm:px-4 py-1.5 rounded-full text-[11px] sm:text-xs font-display font-semibold uppercase tracking-[0.2em] transition-colors ${
                        isActive
                          ? "text-foreground bg-secondary/70 border border-border/60"
                          : "text-muted-foreground hover:text-foreground border border-transparent"
                      }`}
                    >
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>
      )}
    </header>
  );
};

export default EventsHeader;
