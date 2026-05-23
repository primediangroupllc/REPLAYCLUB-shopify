import { useState, useCallback, useRef } from "react";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60 * 1000; // 1 minute cooldown

export const useRateLimiter = () => {
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const attemptsRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const recordAttempt = useCallback(() => {
    attemptsRef.current += 1;
    if (attemptsRef.current >= MAX_ATTEMPTS) {
      setIsLocked(true);
      let remaining = LOCKOUT_MS / 1000;
      setLockoutRemaining(remaining);

      intervalRef.current = setInterval(() => {
        remaining -= 1;
        setLockoutRemaining(remaining);
        if (remaining <= 0) {
          setIsLocked(false);
          attemptsRef.current = 0;
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      }, 1000);
    }
  }, []);

  const resetAttempts = useCallback(() => {
    attemptsRef.current = 0;
    setIsLocked(false);
    setLockoutRemaining(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  return { isLocked, lockoutRemaining, recordAttempt, resetAttempts };
};
