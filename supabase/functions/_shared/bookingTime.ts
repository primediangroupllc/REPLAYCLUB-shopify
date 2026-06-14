// Parse a booking's stored date + time into a Date.
//
// booking_time is stored in 12-hour "h:mm AM/PM" form (e.g. "11:00 AM", "3:00 PM").
// `new Date(`${date}T${time}`)` cannot parse that ("2026-06-17T11:00 AM") and returns
// Invalid Date, which silently breaks every time-dependent check (cancellation cutoff,
// refund auto-approve window, Profile's isUpcoming/canCancel gating). This normalizes
// the 12-hour form to 24h before constructing the Date; already-24h "HH:MM" (or empty)
// values pass through with the prior behavior.
export function parseBookingDateTime(dateStr: string, timeStr?: string | null): Date {
  const t = (timeStr ?? "").trim();
  const m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (m) {
    let h = parseInt(m[1], 10);
    const ampm = m[3].toUpperCase();
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return new Date(`${dateStr}T${String(h).padStart(2, "0")}:${m[2]}:00`);
  }
  return new Date(`${dateStr}T${t || "00:00"}`);
}

// Convert a time string in either 12-hour "h:mm AM/PM" or 24-hour "HH:MM" form
// to minutes-from-midnight. Returns null if unparseable / out of range.
// A <input type="time"> emits 24h ("14:30"); bookings are stored 12h ("2:30 PM").
export function bookingTimeToMinutes(timeStr?: string | null): number | null {
  const t = (timeStr ?? "").trim();
  const m12 = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (m12) {
    const hh = parseInt(m12[1], 10);
    const mm = parseInt(m12[2], 10);
    if (hh < 1 || hh > 12 || mm > 59) return null;
    let h = hh % 12;
    if (m12[3].toUpperCase() === "PM") h += 12;
    return h * 60 + mm;
  }
  const m24 = t.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    const h = parseInt(m24[1], 10);
    const mm = parseInt(m24[2], 10);
    if (h > 23 || mm > 59) return null;
    return h * 60 + mm;
  }
  return null;
}

// Inverse of bookingTimeToMinutes: minutes-from-midnight → canonical stored form
// "h:mm AM/PM" (non-padded hour, 2-digit minute) — matches ALL_HOURLY_SLOTS and
// the AM/PM regex used by the slot/conflict math.
export function minutesToBookingTime(min: number): string {
  const h24 = ((Math.floor(min / 60) % 24) + 24) % 24;
  const mm = ((min % 60) + 60) % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${ampm}`;
}

// Normalize any accepted time form to the canonical stored "h:mm AM/PM".
// Returns null if unparseable. Use this on WRITE paths (e.g. reschedule) so a
// 24h "14:30" from <input type="time"> is never stored verbatim — which would
// make the row invisible to AM/PM-based slot/conflict checks (slotToMin → -1)
// and let someone book right over it.
export function normalizeBookingTime(timeStr?: string | null): string | null {
  const min = bookingTimeToMinutes(timeStr);
  return min == null ? null : minutesToBookingTime(min);
}
