import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Single source of truth for the booking-bootstrap React Query cache key.
 *
 * The IDENTITY segment (the signed-in user's id, or "anon") is what prevents a
 * guest's `{ user: null }` prefetch from ever being served to a signed-in modal:
 * different identity → different cache entry, so authenticating transitions the
 * key and the modal fetches fresh instead of reading the stale guest result.
 *
 * MUST be used by BOTH this prefetch and BookingModal's useQuery — if the two
 * sites build the key differently, the guest "anon" slot and the modal's
 * user-id slot would silently desync (the exact class of bug this fixes).
 *
 * Auth-race history (2026-06-07): before identity-keying, prefetch + modal both
 * used ["booking-bootstrap", email]; a homepage guest prefetch cached
 * `{ user: null }` under ["booking-bootstrap", ""] with staleTime 30s, and a
 * guest who signed up via SPA navigation (no reload) then had the modal read
 * that still-fresh null — email never seeded, "Verify with Stripe" dead-locked.
 */
export const bootstrapKey = (
  userId: string | null | undefined,
  email = "",
) => {
  const emailDim = email.includes("@") ? email.toLowerCase() : "";
  return ["booking-bootstrap", userId ?? "anon", emailDim] as const;
};

/**
 * Warm the booking-bootstrap query before the user opens the modal.
 *
 * Wire to onMouseEnter / onFocus / idle on every primary "Book" CTA. The first
 * call fires the edge function; subsequent calls within 30s are no-ops because
 * BookingModal uses staleTime: 30_000 and the same identity-aware query key.
 *
 * Returns the prefetch promise — fire-and-forget at the call sites, but
 * returning it lets tests await settling.
 */
export const prefetchBookingBootstrap = async (
  queryClient: QueryClient,
  email = "",
) => {
  // Resolve identity FIRST so the warmed entry is keyed to whoever's asking
  // (guest → "anon"; signed-in → user id). Same getSession the queryFn needs
  // for the token, so it's a single read.
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id ?? null;
  const bootstrapEmail = email.includes("@") ? email.toLowerCase() : "";

  return queryClient.prefetchQuery({
    queryKey: bootstrapKey(userId, email),
    staleTime: 30_000,
    queryFn: async () => {
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
