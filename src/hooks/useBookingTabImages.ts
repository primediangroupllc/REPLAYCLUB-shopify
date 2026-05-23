import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchBookingTabImages,
  fetchBookingTabLayout,
  publicUrl,
  type BookingTabImage,
  type BookingTabLayoutVariant,
  type BookingTabType,
} from "@/lib/bookingTabImages";

/**
 * Tiny localStorage-backed cache so booking-tab image URLs survive page
 * reloads. Without this, every reload renders the bundled fallback first,
 * then swaps to the DB image once the query lands — the visible "old
 * images flash, then update" Brian flagged. Now the LAST known DB image
 * URLs render synchronously on reload; background refetch + realtime
 * subscription keep them fresh.
 *
 * Versioned key so we can invalidate stored shape if the schema changes.
 */
const STORAGE_VERSION = 1;
const cacheKey = (suffix: string) => `btab-v${STORAGE_VERSION}:${suffix}`;

function readCache<T>(key: string): T | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function writeCache(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded or storage disabled — silent */
  }
}

/**
 * Returns active images for a given booking tab. Empty array means callers
 * should fall back to their hardcoded image. Cached across the app and
 * persisted to localStorage so reloads don't flash bundled defaults.
 */
export function useBookingTabImages(type: BookingTabType, activeOnly = true) {
  const qc = useQueryClient();
  const queryKey = ["booking-tab-images", type, activeOnly];
  const storage = cacheKey(`images:${type}:${activeOnly}`);
  const cached = readCache<BookingTabImage[]>(storage);
  useEffect(() => {
    const channel = supabase
      .channel(`booking-tab-images-${type}-${activeOnly}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "booking_tab_images",
          filter: `booking_type=eq.${type}`,
        },
        () => qc.invalidateQueries({ queryKey }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, type, activeOnly]);
  return useQuery<BookingTabImage[]>({
    queryKey,
    queryFn: async () => {
      const data = await fetchBookingTabImages(type, activeOnly);
      writeCache(storage, data);
      return data;
    },
    initialData: cached,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: cached ? false : "always",
  });
}

export function useBookingTabLayout(type: BookingTabType) {
  const qc = useQueryClient();
  const queryKey = ["booking-tab-layout", type];
  const storage = cacheKey(`layout:${type}`);
  const cached = readCache<BookingTabLayoutVariant>(storage);
  useEffect(() => {
    const channel = supabase
      .channel(`booking-tab-layout-${type}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "booking_tab_layout",
          filter: `booking_type=eq.${type}`,
        },
        () => qc.invalidateQueries({ queryKey }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, type]);
  return useQuery<BookingTabLayoutVariant>({
    queryKey,
    queryFn: async () => {
      const data = await fetchBookingTabLayout(type);
      writeCache(storage, data);
      return data;
    },
    initialData: cached ?? "gallery",
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: cached ? false : "always",
  });
}

/**
 * Returns the first active image URL per booking type, with realtime sync.
 * Used by surfaces (e.g. home page cards) that need a thumbnail per tab.
 * Persisted to localStorage so reloads don't flash bundled defaults.
 */
export function useFirstImagesByType() {
  const qc = useQueryClient();
  const queryKey = ["booking-tab-images", "first-by-type"];
  const storage = cacheKey("first-by-type");
  const cached = readCache<Record<BookingTabType, string | null>>(storage);
  useEffect(() => {
    const channel = supabase
      .channel("booking-tab-images-first-by-type")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "booking_tab_images" },
        () => qc.invalidateQueries({ queryKey }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc]);
  return useQuery<Record<BookingTabType, string | null>>({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_tab_images")
        .select("booking_type, storage_path, display_order, updated_at")
        .eq("is_active", true)
        .order("booking_type", { ascending: true })
        .order("display_order", { ascending: true });
      if (error) throw error;
      const result: Record<string, string | null> = {};
      for (const row of data ?? []) {
        const type = row.booking_type as BookingTabType;
        if (result[type]) continue;
        const base = publicUrl(row.storage_path as string);
        const updated = (row.updated_at as string | null) ?? null;
        const v = updated ? new Date(updated).getTime() : 0;
        result[type] = v ? `${base}${base.includes("?") ? "&" : "?"}v=${v}` : base;
      }
      const typed = result as Record<BookingTabType, string | null>;
      writeCache(storage, typed);
      return typed;
    },
    initialData: cached ?? ({} as Record<BookingTabType, string | null>),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: cached ? false : "always",
  });
}
