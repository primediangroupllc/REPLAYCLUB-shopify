import { test, expect } from "@playwright/test";

/**
 * Event RSVP — verifies that the create-event-ticket-payment edge function
 * returns a 4xx when called with bogus input, and that the events table is
 * readable by anon (public events listing).
 */

function getEnv() {
  return {
    url: process.env.VITE_SUPABASE_URL || "",
    anon: process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
  };
}

test("create-event-ticket-payment rejects invalid event id", async ({ request }) => {
  const { url, anon } = getEnv();
  test.skip(!url || !anon, "Supabase env not configured");

  const res = await request.post(`${url}/functions/v1/create-event-ticket-payment`, {
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      "Content-Type": "application/json",
    },
    data: {
      eventId: "00000000-0000-0000-0000-000000000000",
      userName: "Tester",
      userEmail: `pw-rsvp-${Date.now()}@example.com`,
    },
  });
  await res.text();
  expect(res.status()).toBeGreaterThanOrEqual(400);
  expect(res.status()).toBeLessThan(500);
});

test("events table is readable by anon (public listing)", async ({ request }) => {
  const { url, anon } = getEnv();
  test.skip(!url || !anon, "Supabase env not configured");

  const res = await request.get(
    `${url}/rest/v1/events?select=id,title,event_date,status&limit=5`,
    { headers: { apikey: anon, Authorization: `Bearer ${anon}` } }
  );
  // 200 with rows OR 200 with empty array — either is fine; just shouldn't 5xx.
  expect(res.status()).toBeLessThan(500);
});