import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchBookingTabsMeta,
  type BookingTabMeta,
  type BookingTabType,
} from "@/lib/bookingTabImages";

const QUERY_KEY = ["booking-tabs-meta"] as const;

/**
 * Returns BookingTabMeta[] ordered by display_order, with realtime sync.
 */
export function useBookingTabsMeta() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("booking-tabs-meta")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "booking_tabs_meta" },
        () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
  return useQuery<BookingTabMeta[]>({
    queryKey: QUERY_KEY,
    queryFn: fetchBookingTabsMeta,
    // Realtime subscription above invalidates on any DB change, so we don't
    // need refetch-on-every-mount thrash. Treats cached data as fresh for
    // 5 min, which keeps page loads instant without going stale in practice.
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    initialData: [] as BookingTabMeta[],
  });
}

export function useBookingTabMetaByType(type: BookingTabType): BookingTabMeta | undefined {
  const { data } = useBookingTabsMeta();
  return useMemo(() => data?.find((m) => m.booking_type === type), [data, type]);
}
