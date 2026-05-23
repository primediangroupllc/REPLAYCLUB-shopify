import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import { installBookingFailureCapture } from "./lib/bookingFailureReporter";
import { installRoutePrefetcher } from "./lib/routePrefetch";
import { supabase } from "./integrations/supabase/client";

installBookingFailureCapture();
installRoutePrefetcher();

// Global handler for Vite/Rollup dynamic-import failures.
//
// After a deploy, hashed chunk filenames change. Returning users with stale
// HTML (or a stale service worker) may try to fetch a chunk that no longer
// exists, causing React.lazy() boundaries to throw "Failed to fetch
// dynamically imported module" or "Importing a module script failed".
//
// Auto-reload once per session to silently recover. The session flag prevents
// reload loops if the failure is real (e.g. offline).
if (typeof window !== "undefined") {
  const RELOAD_KEY = "rc-chunk-reloaded";
  const tryReload = () => {
    try {
      if (sessionStorage.getItem(RELOAD_KEY)) return;
      sessionStorage.setItem(RELOAD_KEY, "1");
    } catch { /* no-op */ }
    window.location.reload();
  };
  window.addEventListener("vite:preloadError", () => {
    tryReload();
  });
  window.addEventListener("error", (e) => {
    const msg = String(e?.message ?? "");
    if (
      /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk \S+ failed|Loading CSS chunk \S+ failed/i.test(
        msg,
      )
    ) {
      tryReload();
    }
  });
}

// TODO(debug-eruda): Remove after iOS camera black-frame bug is diagnosed.
// Loads eruda mobile console only when ?debug=1 is in the URL (or in dev),
// so production users never pay the ~100KB cost.
if (
  typeof window !== "undefined" &&
  (window.location.search.includes("debug=1") || import.meta.env.DEV)
) {
  import("eruda")
    .then(({ default: eruda }) => {
      eruda.init();
    })
    .catch(() => {
      /* no-op */
    });
}

// TODO(debug-verify-flow): Remove after PR 4+5 (BookingModal restructure) ships
// and the 8-step manual draft-booking verification test passes. Temporary
// backdoor that exposes the Supabase client on window so admins can invoke
// edge functions from DevTools to validate the verify→pay flow end-to-end.
if (
  typeof window !== "undefined" &&
  (window.location.search.includes("debug=1") || import.meta.env.DEV)
) {
  (window as unknown as { supabase: typeof supabase }).supabase = supabase;
  // eslint-disable-next-line no-console
  console.log("[debug] supabase client exposed on window.supabase");
}

// Service worker kill-switch.
//
// We previously shipped vite-plugin-pwa, which registered a Workbox service
// worker at /sw.js. Returning users still have that SW installed and it
// serves stale cached assets indefinitely. We've removed the plugin and
// shipped a static kill-switch SW at /sw.js that claims clients, clears
// caches, navigates them to a cache-busting URL, and unregisters itself.
//
// On every page load we also unregister any service worker still attached
// to this origin so the cleanup happens automatically the next time a
// returning user visits.
if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => regs.forEach((r) => r.unregister()))
    .catch(() => { /* no-op */ });
  // Also nuke any caches Workbox left behind.
  if (typeof caches !== "undefined") {
    caches.keys()
      .then((names) => Promise.all(names.map((n) => caches.delete(n))))
      .catch(() => { /* no-op */ });
  }
}

createRoot(document.getElementById("root")!).render(<App />);
