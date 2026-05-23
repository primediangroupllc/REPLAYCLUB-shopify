import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchHomeCardsCustom,
  type HomeCardCustom,
} from "@/lib/bookingTabImages";

const QUERY_KEY = ["home-cards-custom"] as const;

/**
 * Returns admin-authored custom cards ordered by display_order, with realtime
 * sync. Merges with booking_tabs_meta on the home selector (Index.tsx).
 */
export function useHomeCardsCustom() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("home-cards-custom")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "home_cards_custom" },
        () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
  return useQuery<HomeCardCustom[]>({
    queryKey: QUERY_KEY,
    queryFn: fetchHomeCardsCustom,
    // Realtime subscription above pushes invalidations on any DB change,
    // so refetch-on-mount thrash is unnecessary. 5 min staleness keeps
    // page loads instant.
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    initialData: [] as HomeCardCustom[],
  });
}
