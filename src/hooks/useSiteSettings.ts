import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Public site settings + safe hardcoded fallbacks.
 * Customer-facing components read this; if the fetch fails, defaults apply
 * so nothing customer-facing breaks.
 */
export interface PublicSiteSettings {
  // Branding
  logo_light_url: string | null;
  logo_dark_url: string | null;
  favicon_url: string | null;
  // Integrations
  twitch_channel: string;
  youtube_channel_handle: string;
  soundcloud_embed_url: string | null;
  // Ops & safety
  maintenance_mode: boolean;
  maintenance_message: string | null;
  booking_pauses: Record<string, boolean>;
  emergency_contact_phone: string | null;
  // Booking policies (Batch 2). null/undefined → use hardcoded fallback.
  booking_lead_minutes: number | null;
  booking_lookahead_days: number | null;
  cancellation_cutoff_hours: number | null;
  refund_policy_text: string | null;
  // Orbit ring (homepage halo nav). orbit_nodes empty → use hardcoded fallback.
  orbit_enabled: boolean;
  orbit_nodes: OrbitNode[];
}

/**
 * One node in the homepage orbit ring. `route` accepts:
 *   - an internal path beginning with "/" (e.g. "/music-studio")
 *   - an external URL beginning with "http(s)://" (opens in new tab)
 *   - a homepage in-page tab name (e.g. "Backdrops", "Talent")
 */
export interface OrbitNode {
  id: string;
  title: string;
  mobileLabel?: string;
  route: string;
}

export const SITE_SETTINGS_DEFAULTS: PublicSiteSettings = {
  logo_light_url: null,
  logo_dark_url: null,
  favicon_url: null,
  twitch_channel: "REPLAYCLUB_",
  youtube_channel_handle: "@ReplayClubRecords",
  soundcloud_embed_url:
    "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fmp3fumix%2Ffumix-001-replay-club&auto_play=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false&visual=false&show_artwork=false",
  maintenance_mode: false,
  maintenance_message: null,
  booking_pauses: {},
  emergency_contact_phone: null,
  booking_lead_minutes: null,
  booking_lookahead_days: null,
  cancellation_cutoff_hours: null,
  refund_policy_text: null,
  orbit_enabled: true,
  orbit_nodes: [],
};

/**
 * Hardcoded orbit ring used when DB list is empty or fetch fails.
 * Order = display order. Keep labels in sync with the site menu.
 */
export const DEFAULT_ORBIT_NODES: OrbitNode[] = [
  { id: "backdrops", title: "Backdrops", route: "Backdrops" },
  { id: "music", title: "Music", route: "/music-studio" },
  { id: "podcast", title: "Podcast", route: "/podcast-studio" },
  { id: "dj", title: "Disk Jockey", route: "/dj-studio" },
  { id: "livestream", title: "Livestream", route: "/livestream-studio" },
  { id: "rentals", title: "Equipment Rental", mobileLabel: "Rentals", route: "Equipment Rental" },
  { id: "talent", title: "Talent", route: "Talent" },
];

// Hardcoded fallbacks — used wherever DB value is unset. Preserves prior behavior.
export const BOOKING_POLICY_DEFAULTS = {
  leadMinutes: 120,        // 2 hours — matches BookingModal current "+2h" guard
  lookaheadDays: 365,      // effectively unbounded; preserves prior "no max" UX
  cancelCutoffHours: 24,   // matches Profile/Cancellation/cancel-booking copy
  slotLockTtlMinutes: 15,  // matches create-booking-payment default
  equipmentLockTtlMinutes: 10, // matches create-equipment-rental-payment 600s
  refundPolicyText:
    "Cancellations made 48+ hours before your session: full refund minus $35 processing fee. " +
    "Within 24–48 hours: 50% refund. Less than 24 hours or no-show: no refund. Refunds are " +
    "issued to the original payment method and may take 5–10 business days.",
} as const;

export function usePublicSiteSettings() {
  const [settings, setSettings] = useState<PublicSiteSettings>(SITE_SETTINGS_DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("site_settings")
      .select(
        "logo_light_url, logo_dark_url, favicon_url, twitch_channel, youtube_channel_handle, soundcloud_embed_url, maintenance_mode, maintenance_message, booking_pauses, emergency_contact_phone, booking_lead_minutes, booking_lookahead_days, cancellation_cutoff_hours, refund_policy_text, orbit_enabled, orbit_nodes"
      )
      .order("id")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) {
          setLoaded(true);
          return;
        }
        const rawNodes = Array.isArray((data as any).orbit_nodes)
          ? ((data as any).orbit_nodes as any[])
          : [];
        const sanitizedNodes: OrbitNode[] = rawNodes
          .filter((n) => n && typeof n.title === "string" && typeof n.route === "string" && n.title.trim() && n.route.trim())
          .map((n, idx) => ({
            id: typeof n.id === "string" && n.id ? n.id : `node-${idx}`,
            title: String(n.title),
            mobileLabel: typeof n.mobileLabel === "string" && n.mobileLabel ? n.mobileLabel : undefined,
            route: String(n.route),
          }));
        setSettings({
          logo_light_url: data.logo_light_url ?? null,
          logo_dark_url: data.logo_dark_url ?? null,
          favicon_url: data.favicon_url ?? null,
          twitch_channel: data.twitch_channel || SITE_SETTINGS_DEFAULTS.twitch_channel,
          youtube_channel_handle:
            data.youtube_channel_handle || SITE_SETTINGS_DEFAULTS.youtube_channel_handle,
          soundcloud_embed_url:
            data.soundcloud_embed_url || SITE_SETTINGS_DEFAULTS.soundcloud_embed_url,
          maintenance_mode: !!data.maintenance_mode,
          maintenance_message: data.maintenance_message ?? null,
          booking_pauses: (data.booking_pauses as Record<string, boolean>) || {},
          emergency_contact_phone: data.emergency_contact_phone ?? null,
          booking_lead_minutes:
            typeof data.booking_lead_minutes === "number" ? data.booking_lead_minutes : null,
          booking_lookahead_days:
            typeof data.booking_lookahead_days === "number" ? data.booking_lookahead_days : null,
          cancellation_cutoff_hours:
            typeof data.cancellation_cutoff_hours === "number"
              ? data.cancellation_cutoff_hours
              : null,
          refund_policy_text: data.refund_policy_text ?? null,
          orbit_enabled: (data as any).orbit_enabled !== false,
          orbit_nodes: sanitizedNodes,
        });
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { settings, loaded };
}

/**
 * Service-key map matches the slugs used in the customer-facing booking flow.
 * Keep in sync with the admin Settings UI.
 */
export const PAUSABLE_SERVICES = [
  { key: "music", label: "Music" },
  { key: "dj", label: "Disk Jockey" },
  { key: "podcast", label: "Podcast" },
  { key: "livestream", label: "Livestream" },
  { key: "backdrops", label: "Backdrops" },
  { key: "equipment", label: "Equipment Rental" },
  { key: "events", label: "Events" },
] as const;

export type PausableServiceKey = typeof PAUSABLE_SERVICES[number]["key"];
