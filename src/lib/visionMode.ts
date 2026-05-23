/**
 * Vision Mode — display-only simulated revenue distribution targeting
 * $47,000 for the current month. No data is modified anywhere; this only
 * shapes numbers shown on the admin analytics dashboard.
 */
export const VISION_MODE_MONTHLY_TARGET_CENTS = 47_000_00;

/** Per-room split that sums to the monthly target. Realistic mix. */
export const VISION_MODE_ROOM_SPLIT: Array<{ name: string; cents: number; bookings: number }> = [
  { name: "Music",            cents: 14_100_00, bookings: 38 }, // 30%
  { name: "Disk Jockey",      cents: 11_750_00, bookings: 32 }, // 25%
  { name: "Podcast",          cents:  9_400_00, bookings: 26 }, // 20%
  { name: "Equipment Rental", cents:  4_700_00, bookings: 14 }, // 10%
  { name: "Livestream",       cents:  3_290_00, bookings:  9 }, // 7%
  { name: "Backdrops",        cents:  2_350_00, bookings:  7 }, // 5%
  { name: "Events",           cents:  1_410_00, bookings:  4 }, // 3%
];
// 14100+11750+9400+4700+3290+2350+1410 = 47000 ✓

export const VISION_MODE_TOTAL_BOOKINGS = VISION_MODE_ROOM_SPLIT.reduce((s, r) => s + r.bookings, 0);
export const VISION_MODE_UNIQUE_CUSTOMERS = 84;

/** A 12-month revenue trend ending at the current-month target. */
export function visionMonthlyRevenueSeries(now: Date): Array<{ month: string; revenue: number }> {
  // Soft ramp leading up to target month.
  const factors = [0.18, 0.22, 0.27, 0.31, 0.38, 0.46, 0.55, 0.63, 0.72, 0.82, 0.91, 1.0];
  return factors.map((f, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const month = d.toLocaleString("default", { month: "short" });
    const y = d.getFullYear();
    return {
      month: `${month} '${String(y).slice(2)}`,
      revenue: Math.round((VISION_MODE_MONTHLY_TARGET_CENTS / 100) * f),
    };
  });
}

export function visionMonthlyBookingsSeries(now: Date): Array<{ month: string; count: number }> {
  const factors = [0.20, 0.24, 0.30, 0.34, 0.40, 0.48, 0.56, 0.64, 0.73, 0.83, 0.92, 1.0];
  return factors.map((f, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const month = d.toLocaleString("default", { month: "short" });
    const y = d.getFullYear();
    return {
      month: `${month} '${String(y).slice(2)}`,
      count: Math.round(VISION_MODE_TOTAL_BOOKINGS * f),
    };
  });
}
