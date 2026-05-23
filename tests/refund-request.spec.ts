import { test, expect } from "@playwright/test";

/**
 * Refund request — validates the request-refund edge function rejects
 * unknown bookings cleanly. Direct RPC test, no UI needed.
 */
test("request-refund rejects unknown booking id", async ({ request }) => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
  test.skip(!supabaseUrl || !anonKey, "Supabase env not configured");

  const res = await request.post(`${supabaseUrl}/functions/v1/request-refund`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    data: {
      bookingId: "00000000-0000-0000-0000-000000000000",
      reason: "Automated test — should fail",
      customerEmail: "refund-test@example.com",
    },
  });

  // Should be a 4xx (not found / forbidden / bad request) — never a 5xx.
  expect(res.status()).toBeGreaterThanOrEqual(400);
  expect(res.status()).toBeLessThan(500);
  await res.text();
});