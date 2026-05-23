import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Detects when a newer build has been deployed and prompts the user to
 * refresh. Fetches /version.json on a 5-min interval, plus on tab refocus
 * (since people leave tabs open for hours). When the fetched buildId
 * differs from the bundle's __BUILD_ID__, surface a sonner toast with a
 * "Refresh" button. Once toasted, won't fire again until the tab is
 * reloaded.
 *
 * Why not auto-reload silently: users mid-booking shouldn't be yanked
 * back to step 1 without warning. The toast gives them the choice. Pair
 * with ChunkErrorBoundary (already wired) which handles the case where
 * a stale tab hits a chunk hash that no longer exists — that path
 * force-reloads since the alternative is a broken page.
 */
const POLL_INTERVAL_MS = 5 * 60 * 1000;
const FIRST_CHECK_DELAY_MS = 30_000;

const VersionCheck = () => {
  useEffect(() => {
    let cancelled = false;
    let alreadyToasted = false;

    const check = async () => {
      if (cancelled || alreadyToasted) return;
      try {
        const r = await fetch("/version.json", { cache: "no-store" });
        if (!r.ok) return;
        const data = await r.json();
        if (cancelled || alreadyToasted) return;
        if (
          typeof data?.buildId === "string" &&
          data.buildId !== __BUILD_ID__
        ) {
          alreadyToasted = true;
          toast("New version available", {
            description: "Refresh to get the latest updates.",
            action: {
              label: "Refresh",
              onClick: () => window.location.reload(),
            },
            duration: Infinity,
          });
        }
      } catch {
        // Network blip — silent. Try again on next interval.
      }
    };

    const firstTimeout = window.setTimeout(check, FIRST_CHECK_DELAY_MS);
    const interval = window.setInterval(check, POLL_INTERVAL_MS);
    const onFocus = () => {
      // When the user returns to the tab after being away (most common
      // stale-tab path), check immediately rather than wait up to 5 min.
      check();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.clearTimeout(firstTimeout);
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return null;
};

export default VersionCheck;
