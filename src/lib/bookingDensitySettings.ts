import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BookingDensitySettings {
  bufferMinutes: number;
  dailyCap: number;
  sharedRoomPool: boolean;
}

const DEFAULTS: BookingDensitySettings = {
  bufferMinutes: 30,
  dailyCap: 4,
  sharedRoomPool: true,
};

export function useBookingDensitySettings() {
  return useQuery({
    queryKey: ["booking-density-settings"],
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    queryFn: async (): Promise<BookingDensitySettings> => {
      const { data, error } = await supabase.rpc("get_booking_density_settings");
      if (error || !data || (Array.isArray(data) && data.length === 0)) return DEFAULTS;
      const row = Array.isArray(data) ? data[0] : data;
      return {
        bufferMinutes: row?.booking_buffer_minutes ?? DEFAULTS.bufferMinutes,
        dailyCap: row?.daily_session_cap ?? DEFAULTS.dailyCap,
        sharedRoomPool: row?.shared_room_pool ?? DEFAULTS.sharedRoomPool,
      };
    },
  });
}

export const BOOKING_DENSITY_DEFAULTS = DEFAULTS;
