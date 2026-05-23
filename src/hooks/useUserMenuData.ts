import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { haptic } from "@/lib/haptics";
import { computeTier, TierInfo, TierName } from "@/hooks/useUserTier";

export type Tier = { name: string; minBookings: number };

export type UserMenuData = {
  loading: boolean;
  bookingCount: number;
  unreadNotifications: number;
  currentTier: { name: TierName | string; minBookings: number };
  nextTier: { name: TierName | string; minBookings: number } | null;
  progressPct: number;
  discountPercent: number;
  tierInfo: TierInfo;
  lastBooking: { roomTitle: string; service: string | null } | null;
  abandoned: { service: string; createdAt: string } | null;
};

const initialTier = computeTier(0);
const empty: UserMenuData = {
  loading: true,
  bookingCount: 0,
  unreadNotifications: 0,
  currentTier: { name: initialTier.tier, minBookings: 0 },
  nextTier: initialTier.nextTierMin !== null ? { name: initialTier.nextTier, minBookings: initialTier.nextTierMin } : null,
  progressPct: 0,
  discountPercent: initialTier.discountPercent,
  tierInfo: initialTier,
  lastBooking: null,
  abandoned: null,
};

/**
 * Aggregates lightweight per-user signals shown in the SiteMenu:
 *  - Cumulative booking count → loyalty tier + progress bar
 *  - Unread notification count → red dot badge
 *  - Most recent paid booking → "Rebook" shortcut
 *  - Abandoned checkout → "Resume booking" prompt
 *
 * Each query is best-effort; failures degrade silently so the menu
 * remains usable even when tables are restricted by RLS for guests.
 */
export const useUserMenuData = (email: string | null): UserMenuData => {
  const [data, setData] = useState<UserMenuData>(empty);

  useEffect(() => {
    if (!email) {
      setData({ ...empty, loading: false });
      return;
    }
    let cancelled = false;

    (async () => {
      const [bookingsRes, notifRes, lastRes, abandonRes] = await Promise.all([
        supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("customer_email", email)
          .in("payment_status", ["paid", "promo"]),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_email", email)
          .eq("read", false),
        supabase
          .from("bookings")
          .select("room_title, tier")
          .eq("customer_email", email)
          .in("payment_status", ["paid", "promo"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("abandoned_checkouts")
          .select("service, created_at")
          .eq("email", email)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      const bookingCount = bookingsRes.count ?? 0;
      const unread = notifRes.count ?? 0;

      const tierInfo = computeTier(bookingCount);
      const currentTier = { name: tierInfo.tier, minBookings: 0 };
      const nextTier = tierInfo.nextTierMin !== null
        ? { name: tierInfo.nextTier as string, minBookings: tierInfo.nextTierMin }
        : null;
      const progressPct = tierInfo.progressPct;

      setData({
        loading: false,
        bookingCount,
        unreadNotifications: unread,
        currentTier,
        nextTier,
        progressPct,
        discountPercent: tierInfo.discountPercent,
        tierInfo,
        lastBooking: lastRes.data
          ? { roomTitle: lastRes.data.room_title, service: lastRes.data.tier ?? null }
          : null,
        abandoned: abandonRes.data
          ? { service: abandonRes.data.service, createdAt: abandonRes.data.created_at }
          : null,
      });

      // Tier-up detection — fire a celebratory toast the first time the
      // user crosses into a higher tier on this device. Persisted per
      // email in localStorage so we never re-toast the same milestone.
      try {
        const key = `rc:tier:${email}`;
        const prev = localStorage.getItem(key);
        if (prev === null) {
          // First load on this device — record silently, no toast.
          localStorage.setItem(key, tierInfo.tier);
        } else if (prev !== tierInfo.tier) {
          const order = ["New Member", "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Obsidian"];
          const prevIdx = order.indexOf(prev);
          const nextIdx = order.indexOf(tierInfo.tier);
          if (nextIdx > prevIdx) {
            haptic([20, 40, 20]);
            toast.success(`You reached ${tierInfo.tier}!`, {
              description: `${bookingCount} sessions completed${
                nextTier ? ` — ${nextTier.minBookings - bookingCount} to ${nextTier.name}.` : " — top tier unlocked."
              }`,
              duration: 6000,
            });
          }
          localStorage.setItem(key, tierInfo.tier);
        }
      } catch {
        // ignore storage errors
      }
    })().catch(() => {
      if (!cancelled) setData({ ...empty, loading: false });
    });

    return () => {
      cancelled = true;
    };
  }, [email]);

  return data;
};

// Map abandoned-checkout service strings / booking room_titles to
// actual landing routes. Keeps the menu in lockstep with App.tsx routes.
export const serviceToRoute = (service: string | null | undefined): string => {
  const s = (service || "").toLowerCase();
  if (s.includes("dj")) return "/dj-studio";
  if (s.includes("podcast")) return "/podcast-studio";
  if (s.includes("livestream") || s.includes("stream")) return "/livestream-studio";
  if (s.includes("equipment") || s.includes("rental")) return "/equipment-rental";
  if (s.includes("backdrop") || s.includes("photo")) return "/backdrops";
  if (s.includes("event")) return "/events";
  return "/";
};