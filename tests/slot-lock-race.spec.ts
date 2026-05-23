import { test, expect } from "@playwright/test";

/**
 * Race-condition test: 3 concurrent contexts attempting to lock the same slot.
 * Only one acquire_slot_lock call should return acquired=true.
 *
 * This test hits the database RPC directly via the public anon key — no UI
 * navigation needed. It validates the unique-constraint guarantee inside
 * acquire_slot_lock.
 */
test("only one of three concurrent acquires wins", async ({ request }) => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
  test.skip(!supabaseUrl || !anonKey, "Supabase env not configured");

  const room = "DJ Session";
  // Use a far-future date so we never collide with real bookings.
  const date = "2099-12-31";
  const time = `${10 + Math.floor(Math.random() * 8)}:00 AM`;

  const acquire = (email: string) =>
    request.post(`${supabaseUrl}/rest/v1/rpc/acquire_slot_lock`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      data: {
        p_room_title: room,
        p_booking_date: date,
        p_booking_time: time,
        p_email: email,
        p_ttl_seconds: 60,
      },
    });

  const results = await Promise.all([
    acquire("racer1@test.local"),
    acquire("racer2@test.local"),
    acquire("racer3@test.local"),
  ]);

  const parsed = await Promise.all(results.map(async (r) => {
    const body = await r.json();
    return Array.isArray(body) ? body[0] : body;
  }));

  const winners = parsed.filter((r: any) => r?.acquired === true);
  expect(winners.length).toBe(1);

  // Cleanup
  if (winners[0]?.lock_id) {
    await request.post(`${supabaseUrl}/rest/v1/rpc/release_slot_lock`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      data: { p_lock_id: winners[0].lock_id },
    });
  }
});