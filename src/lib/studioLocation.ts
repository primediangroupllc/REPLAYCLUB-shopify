/**
 * Centralized studio + pickup location constants.
 *
 * IMPORTANT — privacy policy:
 *   - The real studio address is CONFIDENTIAL. It must NEVER appear in any
 *     public-facing surface: marketing pages, JSON-LD schema, OG tags,
 *     sitemap, robots.txt, footer, profile UI, calendar invites for unpaid
 *     bookings, etc.
 *   - The address is only revealed in the post-confirmation email/SMS
 *     after admin approval AND payment, gated by `bookings.address_revealed`.
 *   - PUBLIC_DESCRIPTOR is the only location string allowed on public pages.
 *   - PICKUP_LANDMARK is the meet point shown to confirmed clients in their
 *     confirmation email. They meet an escort here who walks them to the
 *     studio. The actual studio address is intentionally separate.
 */

/** Vague public descriptor — safe to render anywhere. */
export const PUBLIC_DESCRIPTOR = "Private studio in Los Angeles";

/** Pickup landmark — included in confirmation emails only. */
export const PICKUP_LANDMARK = {
  name: "Pickup point",
  street: "14521 Friar St",
  city: "Van Nuys",
  region: "CA",
  postalCode: "91411",
  country: "United States",
  formatted: "14521 Friar St, Van Nuys, CA 91411",
  mapsUrl:
    "https://www.google.com/maps/search/?api=1&query=14521+Friar+St+Van+Nuys+CA+91411",
  directionsUrl:
    "https://www.google.com/maps/dir/?api=1&destination=14521+Friar+St+Van+Nuys+CA+91411",
} as const;

/** Instruction copy used in confirmation emails. */
export const PICKUP_INSTRUCTIONS = [
  "Park at or near the pickup point and reply to your confirmation email or text the studio number to let us know you've arrived.",
  "An escort from Replay Club will meet you within a few minutes and walk you to the studio entrance.",
  "Please do not share the pickup point or studio location publicly. Address confidentiality is part of our entry terms.",
  "Bring a valid photo ID matching the name on your booking.",
] as const;
