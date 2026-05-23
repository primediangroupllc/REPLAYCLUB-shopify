/**
 * Booking time-slot generator + availability rules.
 *
 * Operating policy (2026-04-24):
 *   - Studio open 10:00 AM – 10:00 PM
 *   - 2-hour-minimum rooms (Studio Sesh, Podcast, DJ, Photoshoot):
 *       last start = 8:00 PM (session ends by 10 PM)
 *   - 1-hour-minimum rooms (Livestream): last start = 9:00 PM
 *   - 30-minute buffer between back-to-back bookings in the same room.
 *
 * The `bookings` table does not store session duration, so the buffer is
 * applied defensively: the hourly slot immediately following any booked or
 * locked slot is also marked unavailable. This guarantees ≥30 min turnover
 * even when the prior session runs the room minimum.
 */

import {
  ROOM_LIVESTREAM,
  ROOM_EQUIPMENT_RENTAL,
  type RoomTitle,
} from "@/lib/bookingConstants";

const ALL_HOURLY_SLOTS = [
  "10:00 AM", "11:00 AM", "12:00 PM",
  "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM",
  "5:00 PM", "6:00 PM", "7:00 PM", "8:00 PM", "9:00 PM",
] as const;

/** Returns the bookable start times for a given room title. */
export function getTimeSlotsForRoom(roomTitle: string | undefined): string[] {
  if (!roomTitle || roomTitle === ROOM_EQUIPMENT_RENTAL) return [];
  // Livestream is the only 1-hour room → can start as late as 9 PM.
  if (roomTitle === ROOM_LIVESTREAM) return [...ALL_HOURLY_SLOTS];
  // All other rooms enforce a 2-hour minimum → last start = 8 PM.
  return ALL_HOURLY_SLOTS.slice(0, ALL_HOURLY_SLOTS.indexOf("8:00 PM") + 1);
}

/** Convert "1:00 PM" → minutes from midnight (780). */
function slotToMinutes(slot: string): number {
  const m = slot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return -1;
  let h = parseInt(m[1], 10) % 12;
  if (m[3].toUpperCase() === "PM") h += 12;
  return h * 60 + parseInt(m[2], 10);
}

/**
 * Given the slots that are explicitly booked or locked, return the SUPERSET
 * that should be displayed as unavailable (adds the next hourly slot after
 * each one to enforce the 30-min same-room buffer).
 *
 * MATH (must stay in lock-step with the server-side check in
 * supabase/functions/create-booking-payment/index.ts):
 *   - Each existing booking row is assumed to occupy ASSUMED_BOOKING_MINUTES
 *     (60 min) starting at its booking_time. A 2-hour session is therefore
 *     stored as two consecutive rows.
 *   - Its blocked range is [start, start + 60 + bufferMinutes).
 *   - A candidate hourly slot at H is unavailable iff the half-open interval
 *     [H, H + 60) intersects the blocked range, i.e.
 *         H + 60 > start  AND  H < start + 60 + bufferMinutes
 */
const ASSUMED_BOOKING_MINUTES = 60;
const SLOT_LENGTH_MINUTES = 60;

export function applyBufferToUnavailable(
  unavailable: Iterable<string>,
  roomTitle: string | undefined,
  bufferMinutes: number = 30,
): Set<string> {
  const result = new Set<string>(unavailable);
  const allowed = getTimeSlotsForRoom(roomTitle);
  if (allowed.length === 0) return result;
  const buffer = Math.max(0, bufferMinutes);
  const blockedRanges: Array<[number, number]> = [];
  for (const slot of unavailable) {
    const start = slotToMinutes(slot);
    if (start < 0) continue;
    blockedRanges.push([start, start + ASSUMED_BOOKING_MINUTES + buffer]);
  }
  for (const candidate of allowed) {
    const h = slotToMinutes(candidate);
    if (h < 0) continue;
    const candEnd = h + SLOT_LENGTH_MINUTES;
    for (const [s, e] of blockedRanges) {
      // half-open interval intersection: [h, candEnd) ∩ [s, e) ≠ ∅
      if (candEnd > s && h < e) {
        result.add(candidate);
        break;
      }
    }
  }
  return result;
}

/** Cast helper for places that work on the canonical RoomTitle union. */
export function isHourlyBookableRoom(title: string | undefined): title is RoomTitle {
  if (!title) return false;
  return title !== ROOM_EQUIPMENT_RENTAL;
}
