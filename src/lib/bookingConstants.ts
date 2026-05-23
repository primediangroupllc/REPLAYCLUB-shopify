/**
 * Single source of truth for booking-related strings and pricing.
 *
 * IMPORTANT: Do NOT hardcode room titles, tab names, or backdrop/equipment
 * pricing anywhere else in the codebase. Always import from this file so a
 * rename here propagates everywhere and prevents the kind of "Equipment Rental"
 * vs "Equipment Rentals" mismatch that previously broke the booking flow.
 */

// ---------------- Tab names (halo nav + ?tab= query param) ----------------
export const TAB_BACKDROPS = "Backdrops" as const;
export const TAB_TALENT = "Talent" as const;

// ---------------- Canonical room titles ----------------
export const ROOM_STUDIO_SESH = "Studio Sesh" as const;
export const ROOM_PODCAST = "Podcast" as const;
export const ROOM_DJ_SESSION = "Disk Jockey" as const;
export const ROOM_PHOTOSHOOT = "Photoshoot" as const;
export const ROOM_LIVESTREAM = "Livestream" as const;
export const ROOM_EQUIPMENT_RENTAL = "Equipment Rental" as const;
export const ROOM_MUSIC = "Music" as const;

export type RoomTitle =
  | typeof ROOM_STUDIO_SESH
  | typeof ROOM_PODCAST
  | typeof ROOM_DJ_SESSION
  | typeof ROOM_PHOTOSHOOT
  | typeof ROOM_LIVESTREAM
  | typeof ROOM_EQUIPMENT_RENTAL
  | typeof ROOM_MUSIC;

// ---------------- Backdrops (hourly add-ons) ----------------
export interface Backdrop {
  name: string;
  description: string;
  priceCents: number; // hourly
  image: string;
}

// ---------------- Equipment daily rental pricing ($/day) ----------------
// Used by both the Equipment Rental cart and the Booking Modal summary.
export const rentalPriceMap: Record<string, number> = {
  "AlphaTheta XDJ-AZ": 125,
  "Ableton Push": 25,
  "Novation Launch Control": 15,
  "JBL 305P MKii 5\"": 20,
  "Sony FX3": 115,
  "Canon 90D": 65,
  "DJI Wireless Mic": 15,
  "Sony 4K FDR-X3000": 50,
  "SC Electronics V7 Mic": 25,
  "Sony C800": 135,
  "TLM 103": 40,
  "SHURE SM7B": 20,
  "BACH 195 w/ Vintage U87 Capsule": 70,
  "BLUE Condenser Mic": 15,
  "Prophet 8": 175,
  "Cube Amp": 10,
  "Phone Ring Light x2": 10,
  "GVM PRO-SD300B": 35,
  "LED Light Bar x2": 20,
  "ART & Lutherie Acoustic": 20,
  "Lava Acoustic": 15,
  "DT 990 Pro Headphones": 10,
  "DT 770 Headphones": 10,
  "Ronin RS3 Mini": 45,
  "Rode Shotgun Mic": 20,
  "Sony FX3 XLR Mic Attachment": 15,
  "Prism FX Lenses x4": 30,
  "Canon 70-200mm Lens": 45,
  "Custom Lighting Setup": 0,
  "Custom Background": 0,
};

// ---------------- Fees ----------------
// Platform fee removed for public launch (PR 4c). Kept as a 0-valued
// constant so existing call sites in BookingModal continue to compile
// without a refactor — the math becomes a no-op. If a fee is ever
// reintroduced, change the value here.
export const TRANSACTION_FEE_CENTS = 0;

// ---------------- Photo packages (flat-fee add-ons sold via the cart) ----------------
/**
 * Packages and add-on bundles flow through the same cart pipeline as backdrops
 * and equipment. They're priced as flat one-time fees (unit: "flat") so the
 * BookingModal summary doesn't multiply them by hours or rental days.
 *
 * Names MUST be unique across BACKDROPS, equipment, and PHOTO_PACKAGES so
 * cartLookup() in Index.tsx can resolve every cart entry deterministically.
 */
export interface PhotoPackage {
  name: string;
  tagline: string;
  description: string;
  priceCents: number; // flat
  includes: string[];
}

export const PHOTO_PACKAGES: PhotoPackage[] = [
  {
    name: "Self-Service Shoot",
    tagline: "DIY",
    description: "Bring your own photographer. Backdrop + space only — full creative control.",
    priceCents: 0,
    includes: [
      "Backdrop access (selected above)",
      "Use of overhead key light",
      "No photographer included",
    ],
  },
  {
    name: "Basic Photo Package",
    tagline: "50 photos",
    description: "In-house photographer, 1-hour shoot, 50 lightly-edited delivered photos within 5 days.",
    priceCents: 25000,
    includes: [
      "1-hour session with our photographer",
      "50 color-corrected photos",
      "Online gallery delivery (5-day turnaround)",
    ],
  },
  {
    name: "Professional Photographer Package",
    tagline: "100 photos",
    description: "Pro photographer, 2-hour shoot, 100 fully-edited photos with retouching.",
    priceCents: 45000,
    includes: [
      "2-hour session with senior photographer",
      "100 fully retouched photos",
      "Online gallery delivery (3-day turnaround)",
      "Includes basic lighting setup",
    ],
  },
  {
    name: "Premium Editorial Package",
    tagline: "200 photos",
    description: "Editorial-grade shoot — 3 hours, 200 retouched photos, advanced lighting + styling guidance.",
    priceCents: 75000,
    includes: [
      "3-hour session with editorial photographer",
      "200 fully retouched photos",
      "Advanced lighting + on-set styling guidance",
      "Online gallery (48-hour turnaround)",
    ],
  },
];

// Curated bundle of existing rental items, sold as a single cart line at a discount.
// À-la-carte total = $35 (GVM) + 2×$10 (LED bars) + 2×$5 (ring lights) ≈ $65/day.
// Bundle price: $55/day saved into one item to reduce cart clutter.
export interface AddOnBundle {
  name: string;
  description: string;
  priceCents: number; // flat (one-time)
  includes: string[];
}

export const ADDON_BUNDLES: AddOnBundle[] = [
  {
    name: "Pro Lighting Package",
    description: "GVM PRO-SD300B + 2× LED Light Bars + 2× ring lights — full key/fill/rim coverage.",
    priceCents: 5500,
    includes: ["GVM PRO-SD300B", "LED Light Bar x2", "Phone Ring Light x2"],
  },
];

// Curated individual add-ons users can stack on top of a package.
// These names must match the canonical equipment names in rentalPriceMap.
export const PHOTO_ADDON_EQUIPMENT = [
  "Sony FX3",
  "Canon 90D",
  "Canon 70-200mm Lens",
  "Prism FX Lenses x4",
  "GVM PRO-SD300B",
  "LED Light Bar x2",
] as const;

/**
 * Paid photo packages that REQUIRE an in-house photographer.
 * Used by admin views to flag bookings that need staff scheduling.
 * "Self-Service Shoot" is excluded — customers bring their own photographer.
 */
export const PHOTOGRAPHER_PACKAGES: readonly string[] = [
  "Basic Photo Package",
  "Professional Photographer Package",
  "Premium Editorial Package",
] as const;

/** Returns the matching photographer package name, or null if none. */
export function findPhotographerPackage(
  equipment: unknown
): string | null {
  if (!Array.isArray(equipment)) return null;
  for (const item of equipment) {
    const name = String(item ?? "");
    if (PHOTOGRAPHER_PACKAGES.includes(name)) return name;
  }
  return null;
}
