import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBookingTabsMeta } from "./useBookingTabsMeta";
import type { BookingTabType } from "@/lib/bookingTabImages";

interface Row {
  booking_type: BookingTabType;
  equipment_name: string;
}

const QUERY_KEY = ["service-equipment-requirements"] as const;
const EMPTY: string[] = [];

/**
 * Admin-editable mapping of service → required equipment. Powers the
 * BookingModal calendar's per-service hardware-conflict check. See the
 * service_equipment_requirements table.
 */
export function useServiceEquipmentRequirements() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("service-equipment-requirements")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_equipment_requirements" },
        () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const { data: rows = [] } = useQuery<Row[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("service_equipment_requirements")
        .select("booking_type, equipment_name");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    staleTime: 60_000,
    initialData: [] as Row[],
  });

  const { data: metaData = [] } = useBookingTabsMeta();

  // Map: title → equipment_name[] (consumer-friendly; titles are admin-renameable)
  const byTitle = useMemo<Record<string, string[]>>(() => {
    const typeToTitle: Record<string, string> = {};
    metaData.forEach((m) => {
      typeToTitle[m.booking_type] = m.title;
    });
    const result: Record<string, string[]> = {};
    rows.forEach((r) => {
      const title = typeToTitle[r.booking_type];
      if (!title) return;
      if (!result[title]) result[title] = [];
      result[title].push(r.equipment_name);
    });
    return result;
  }, [rows, metaData]);

  // Map: booking_type → equipment_name[] (stable; use this when persisting)
  const byBookingType = useMemo<Record<string, string[]>>(() => {
    const result: Record<string, string[]> = {};
    rows.forEach((r) => {
      if (!result[r.booking_type]) result[r.booking_type] = [];
      result[r.booking_type].push(r.equipment_name);
    });
    return result;
  }, [rows]);

  return {
    rows,
    byTitle,
    byBookingType,
    getRequired: (roomTitle: string | null | undefined): string[] => {
      if (!roomTitle) return EMPTY;
      return byTitle[roomTitle] ?? EMPTY;
    },
    getServicesUsing: (equipmentName: string): string[] => {
      return Object.entries(byTitle)
        .filter(([, items]) => items.includes(equipmentName))
        .map(([title]) => title);
    },
  };
}

/**
 * Sugar hook for the common case: "what equipment does this room title need?"
 */
export function useRequiredEquipment(
  roomTitle: string | null | undefined,
): string[] {
  const { byTitle } = useServiceEquipmentRequirements();
  return useMemo(() => {
    if (!roomTitle) return EMPTY;
    return byTitle[roomTitle] ?? EMPTY;
  }, [roomTitle, byTitle]);
}
