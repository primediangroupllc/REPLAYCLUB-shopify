import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// Stricter timeout for admin pages: 10 min of inactivity → sign out.
// This is in addition to the global useSessionTimeout (30 min).
const ADMIN_TIMEOUT_MS = 10 * 60 * 1000;
const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll"] as const;
const ADMIN_2FA_KEY = "admin_2fa_verified_at";

export const useAdminSessionTimeout = (enabled: boolean) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const logout = useCallback(async () => {
    try {
      sessionStorage.removeItem(ADMIN_2FA_KEY);
    } catch { /* ignore */ }
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }, []);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(logout, ADMIN_TIMEOUT_MS);
  }, [logout]);

  useEffect(() => {
    if (!enabled) return;
    resetTimer();
    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, resetTimer, { passive: true })
    );
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, [enabled, resetTimer]);
};