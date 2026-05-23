/**
 * TTL-aware wrapper around sessionStorage for in-flight booking drafts.
 *
 * Drafts expire after 30 minutes of inactivity. On every read past the TTL,
 * the entry is removed and `null` is returned, so the caller starts fresh.
 *
 * Stored shape: { data: T, lastUpdated: number }
 */

export const BOOKING_DRAFT_TTL_MS = 30 * 60 * 1000; // 30 minutes
export const BOOKING_DRAFT_PREFIX = "booking-draft:";

type Wrapped<T> = { data: T; lastUpdated: number };

export function readBookingDraft<T = unknown>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Wrapped<T> | T;
    // Back-compat: legacy drafts were stored unwrapped. Treat them as expired.
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("lastUpdated" in (parsed as Record<string, unknown>)) ||
      !("data" in (parsed as Record<string, unknown>))
    ) {
      sessionStorage.removeItem(key);
      return null;
    }
    const wrapped = parsed as Wrapped<T>;
    if (Date.now() - wrapped.lastUpdated > BOOKING_DRAFT_TTL_MS) {
      sessionStorage.removeItem(key);
      return null;
    }
    return wrapped.data;
  } catch {
    return null;
  }
}

export function writeBookingDraft<T>(key: string, data: T): void {
  try {
    const wrapped: Wrapped<T> = { data, lastUpdated: Date.now() };
    sessionStorage.setItem(key, JSON.stringify(wrapped));
  } catch {
    // storage may be full / disabled — non-fatal
  }
}

export function clearBookingDraft(key: string): void {
  try { sessionStorage.removeItem(key); } catch {}
}

/** Wipe every booking draft regardless of room. Used on sign-out. */
export function clearAllBookingDrafts(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(BOOKING_DRAFT_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => sessionStorage.removeItem(k));
  } catch {}
}