// Shared tier computation — single source of truth for both the SiteMenu
// badge and the Profile loyalty card. If you change the tier ladder,
// change it here only.

export type TierName =
  | "New Member"
  | "Bronze"
  | "Silver"
  | "Gold"
  | "Platinum"
  | "Diamond"
  | "Obsidian";

export interface TierDef {
  min: number;
  name: TierName;
  discount: number;
}

// Highest-min first so .find(t => count >= t.min) returns the top
// qualifying tier. `discount` is the recurring percent off applied at
// checkout for every booking while the user is in that tier.
export const TIER_LADDER: TierDef[] = [
  { min: 100, name: "Obsidian", discount: 30 },
  { min: 50, name: "Diamond", discount: 25 },
  { min: 20, name: "Platinum", discount: 20 },
  { min: 10, name: "Gold", discount: 15 },
  { min: 5, name: "Silver", discount: 10 },
  { min: 3, name: "Bronze", discount: 5 },
  { min: 0, name: "New Member", discount: 0 },
];

export interface TierInfo {
  bookingCount: number;
  tier: TierName;
  discountPercent: number;
  nextTier: TierName | "Max";
  nextTierMin: number | null;
  sessionsToNext: number;
  progressPct: number;
}

export const computeTier = (paidCount: number): TierInfo => {
  const current = TIER_LADDER.find((t) => paidCount >= t.min) || TIER_LADDER[TIER_LADDER.length - 1];
  const idx = TIER_LADDER.indexOf(current);
  const next = idx > 0 ? TIER_LADDER[idx - 1] : null;
  const sessionsToNext = next ? Math.max(0, next.min - paidCount) : 0;
  const span = next ? next.min - current.min : 1;
  const progressPct = next
    ? Math.min(100, Math.round(((paidCount - current.min) / span) * 100))
    : 100;
  return {
    bookingCount: paidCount,
    tier: current.name,
    discountPercent: current.discount,
    nextTier: next?.name ?? "Max",
    nextTierMin: next?.min ?? null,
    sessionsToNext,
    progressPct,
  };
};
