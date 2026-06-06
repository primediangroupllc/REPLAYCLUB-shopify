import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Warm the booking-bootstrap query before the user opens the modal.
 *
 * Wire to onMouseEnter / onFocus on every primary "Book" CTA. The first call
 * fires the edge function; subsequent calls within 30s are no-ops because
 * BookingModal uses staleTime: 30_000 and the same query key.
 */
export const prefetchBookingBootstrap = (
  queryClient: QueryClient,
  email = "",
) => {
  const bootstrapEmail = email.includes("@") ? email.toLowerCase() : "";
  queryClient.prefetchQuery({
    queryKey: ["booking-bootstrap", bootstrapEmail],
    staleTime: 30_000,
    queryFn: async () => {
      // Auth-race fix (2026-06-06): await session hydration and attach the user
      // token explicitly, so a pre-hydration hover-prefetch can't cache a
      // `user: null` result under the shared ["booking-bootstrap", ""] key
      // (which the modal would then read for up to 30s). See BookingModal.
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke(
        "get-booking-bootstrap",
        {
          body: bootstrapEmail ? { email: bootstrapEmail } : {},
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : undefined,
        },
      );
      if (error) throw error;
      return data;
    },
  });
};