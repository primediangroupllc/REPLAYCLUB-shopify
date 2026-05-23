/**
 * Studio configuration types + room-title <-> studio_key mapping.
 *
 * Layouts/tiers/addons are admin-editable in the database but the SHAPE
 * is fixed by these types. The customer booking flow reads from the DB
 * via useStudioConfig() and falls back to the hardcoded defaults below
 * if the row is missing or the network call fails.
 */
import {
  ROOM_DJ_SESSION,
  ROOM_PODCAST,
  ROOM_LIVESTREAM,
  ROOM_MUSIC,
  TAB_BACKDROPS,
} from "@/lib/bookingConstants";

export type StudioKey = "music" | "dj" | "podcast" | "livestream" | "backdrops";

export interface StudioLayout {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  sort_order?: number;
}

export interface StudioTier {
  id: string;
  label: string;
  /** Hourly price in cents. Use 0 for "Custom Quote" tiers. */
  price_cents_per_hour: number;
  features: string[];
  /** Optional one-time add-on fee on top of hourly (e.g. Podcast edit). */
  flat_addon_cents?: number;
  description?: string;
  image_url?: string;
  sort_order?: number;
}

export interface StudioAddon {
  id: string;
  name: string;
  description?: string;
  /** Price in cents. Meaning depends on `unit`. */
  price_cents: number;
  /** "flat" = one-time, "daily" = per rental day, "hourly" = per booked hour, "bundle" = priced via included items. */
  unit: "flat" | "daily" | "hourly" | "bundle";
  includes?: string[];
  image_url?: string;
  sort_order?: number;
}

export interface StudioConfiguration {
  studio_key: StudioKey;
  display_name: string;
  description: string | null;
  sort_order: number;
  layouts: StudioLayout[];
  tiers: StudioTier[];
  addons: StudioAddon[];
  /** Admin-controlled visibility. When false, hide service from customer surfaces. */
  is_active?: boolean;
  /** Admin-uploaded hero image (overrides the bundled @/assets fallback). */
  hero_image_url?: string | null;
  /** Optional homepage card image. */
  card_image_url?: string | null;
  /** Optional ordered gallery for the landing page. */
  gallery_image_urls?: string[];
  /** Override copy for "Starting at $X" pricing line. */
  starting_at_copy?: string | null;
  /** Cheapest tier in cents (used to derive starting_at_copy when not set). */
  base_price_cents?: number | null;
}

/** Map a customer-facing room title to its studio_key. */
export const ROOM_TO_STUDIO_KEY: Record<string, StudioKey> = {
  [ROOM_MUSIC]: "music",
  [ROOM_DJ_SESSION]: "dj",
  [ROOM_PODCAST]: "podcast",
  [ROOM_LIVESTREAM]: "livestream",
  [TAB_BACKDROPS]: "backdrops",
};

/** Stable order for the admin Studio Config tab selector. */
export const STUDIO_KEYS: StudioKey[] = [
  "music",
  "dj",
  "podcast",
  "livestream",
  "backdrops",
];

export const STUDIO_KEY_LABELS: Record<StudioKey, string> = {
  music: "Music",
  dj: "Disk Jockey",
  podcast: "Podcast",
  livestream: "Livestream",
  backdrops: "Backdrops",
};
