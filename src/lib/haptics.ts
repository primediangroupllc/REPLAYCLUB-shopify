/**
 * Light haptic feedback for touch devices. No-op when unsupported.
 * Use sparingly — only for confirmations / selection moments.
 */
export const haptic = (pattern: number | number[] = 10) => {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // ignore
  }
};