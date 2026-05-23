import { useEffect } from "react";
import { usePublicSiteSettings } from "@/hooks/useSiteSettings";

/**
 * Site-wide bootstrap for admin-editable visuals/messaging.
 *
 * - Swaps the favicon link if a custom favicon URL has been configured.
 * - Renders a top-of-page maintenance banner whenever maintenance mode is on.
 *
 * Customer behavior is unchanged when settings are unset (uses defaults).
 */
const SiteSettingsBoot = () => {
  const { settings } = usePublicSiteSettings();

  useEffect(() => {
    if (!settings.favicon_url) return;
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = settings.favicon_url;
  }, [settings.favicon_url]);

  if (!settings.maintenance_mode) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[110] bg-amber-500/95 text-black px-4 py-2 text-center text-xs font-display font-semibold uppercase tracking-wider shadow-lg">
      {settings.maintenance_message?.trim() || "Site under maintenance — some features may be unavailable."}
    </div>
  );
};

export default SiteSettingsBoot;
