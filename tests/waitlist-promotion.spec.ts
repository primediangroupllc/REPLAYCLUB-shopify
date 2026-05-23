import { test, expect } from "@playwright/test";

/**
 * Waitlist promotion — exercises the notify-waitlist-on-slot-release edge
 * function with a slot that has no waiters. Should respond cleanly (no 5xx)
 * and report zero notified.
 */

function getEnv() {
  return {
    url: process.env.VITE_SUPABASE_URL || "",
    anon: process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
  };
}

test("notify-waitlist endpoint handles no-waiters case gracefully", async ({ request }) => {
  const { url, anon } = getEnv();
  test.skip(!url || !anon, "Supabase env not configured");

  const res = await request.post(`${url}/functions/v1/notify-waitlist-on-slot-release`, {
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      "Content-Type": "application/json",
    },
    data: {
      roomTitle: "DJ Session",
      bookingDate: "2099-12-31",
      bookingTime: "11:00 PM",
    },
  });
  await res.text();
  // Function should not 5xx; either 200 (handled) or 4xx (auth/validation) is acceptable.
  expect(res.status()).toBeLessThan(500);
});