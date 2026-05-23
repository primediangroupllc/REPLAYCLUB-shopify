// Route chunk prefetching.
//
// App.tsx lazy-loads ~50 routes via React.lazy(). The first navigation to
// each one triggers a JS chunk download while the user stares at a blank
// Suspense fallback — the "lazy load" / stale-cache feel.
//
// installRoutePrefetcher() registers a single document-level listener that
// fires the dynamic import() as soon as the user's cursor enters (or
// keyboard focus reaches) any internal anchor. By click time the chunk is
// already in HTTP cache and the route renders synchronously.
//
// Module specifiers below MUST match App.tsx's resolved paths so Rollup
// dedupes them to a single chunk per route. `/` is intentionally absent —
// Index is in the eager entry bundle.

const routePrefetch: Record<string, () => Promise<unknown>> = {
  "/events": () => import("@/pages/Events.tsx"),
  "/equipment-rental": () => import("@/pages/EquipmentRental.tsx"),
  "/join-roster": () => import("@/pages/JoinRoster.tsx"),
  "/gift-cards": () => import("@/pages/GiftCards.tsx"),
  "/music-studio": () => import("@/pages/MusicStudio.tsx"),
  "/dj-studio": () => import("@/pages/DJStudio.tsx"),
  "/podcast-studio": () => import("@/pages/PodcastStudio.tsx"),
  "/livestream-studio": () => import("@/pages/LivestreamStudio.tsx"),
  "/profile": () => import("@/pages/Profile.tsx"),
  "/auth": () => import("@/pages/Auth.tsx"),
  "/policies": () => import("@/pages/Policies.tsx"),
  "/cancellation": () => import("@/pages/Cancellation.tsx"),
  "/conduct": () => import("@/pages/Conduct.tsx"),
  "/privacy-policy": () => import("@/pages/PrivacyPolicy.tsx"),
  "/entry-terms": () => import("@/pages/EntryTerms.tsx"),
  "/how-it-works": () => import("@/pages/HowItWorks.tsx"),
  "/booking-success": () => import("@/pages/BookingSuccess.tsx"),
  "/booking/return": () => import("@/pages/BookingReturn.tsx"),
  "/reset-password": () => import("@/pages/ResetPassword.tsx"),
  "/talent-landing": () => import("@/pages/TalentLanding.tsx"),
  // App.tsx redirects /studio-sesh to /music-studio; prefetch the real target chunk.
  "/studio-sesh": () => import("@/pages/MusicStudio.tsx"),
  "/photoshoot": () => import("@/pages/Photoshoot.tsx"),
};

const prefetched = new Set<string>();

export const prefetchRoute = (to: string | undefined | null) => {
  if (!to) return;
  // Strip query/hash so "/profile?tab=foo" hits the same chunk as "/profile".
  const path = to.split("?")[0].split("#")[0];
  if (prefetched.has(path)) return;
  const fn = routePrefetch[path];
  if (!fn) return; // Eager-bundled (e.g. "/") or unknown — no-op.
  prefetched.add(path);
  // Allow retry on transient failure (offline, network blip).
  fn().catch(() => prefetched.delete(path));
};

let installed = false;

export const installRoutePrefetcher = () => {
  if (installed || typeof document === "undefined") return;
  installed = true;

  const handle = (e: Event) => {
    const target = e.target as Element | null;
    const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!anchor) return;
    const href = anchor.getAttribute("href");
    // Same-origin internal links only — skip "https://...", "mailto:", "#anchor".
    if (!href || !href.startsWith("/")) return;
    prefetchRoute(href);
  };

  // pointerover bubbles and covers mouse, touch, and pen input.
  // focusin bubbles and covers keyboard navigation.
  document.addEventListener("pointerover", handle, { passive: true, capture: true });
  document.addEventListener("focusin", handle, { passive: true, capture: true });
};