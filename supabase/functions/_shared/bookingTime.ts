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
