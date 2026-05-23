import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes of inactivity
const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll"] as const;

export const useSessionTimeout = () => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }, []);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(logout, TIMEOUT_MS);
  }, [logout]);

  useEffect(() => {
    // Only activate if user is signed in
    let active = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        active = true;
        resetTimer();
        ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));
      }
    });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (active) {
        ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, resetTimer));
      }
    };
  }, [resetTimer]);
};
