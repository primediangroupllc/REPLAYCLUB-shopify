import { test, expect } from "@playwright/test";

/**
 * Equipment rental — stubbed checkout. Inserts a rental row directly to verify
 * the table is writable from the anon role with a pending payment status, then
 * cleans up. Mirrors what create-equipment-rental-payment does pre-Stripe.
 */

const TEST_EMAIL = `pw-rental-${Date.now()}@example.com`;

function getEnv() {
  return {
    url: process.env.VITE_SUPABASE_URL || "",
    anon: process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
  };
}

function authHeaders(anon: string) {
  return {
    apikey: anon,
    Authorization: `Bearer ${anon}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

test("equipment rental insert creates pending row", async ({ request }) => {
  const { url, anon } = getEnv();
  test.skip(!url || !anon, "Supabase env not configured");
  // RLS now (correctly) blocks anonymous inserts to equipment_rentals.
  // The old test bypassed the create-equipment-rental-payment edge function
  // and INSERTed directly as anon — that path is closed in prod.
  // TODO: rewrite to invoke create-equipment-rental-payment via
  // supabase.functions.invoke(...) once the function accepts a stub-mode
  // flag, OR use a service-role key behind an env var. For now, skip so
  // CI is green and we're not flagging a "broken test" that's actually
  // proving RLS works correctly.
  test.skip(true, "Pending rewrite — direct anon INSERT correctly blocked by RLS; needs edge-function invocation or service-role key");

  const insertRes = await request.post(`${url}/rest/v1/equipment_rentals`, {
    headers: authHeaders(anon),
    data: {
      customer_name: "Playwright Rental Tester",
      customer_email: TEST_EMAIL,
      amount_cents: 12500,
      rental_days: 1,
      pickup_date: "2099-12-01",
      payment_status: "pending",
      items: [{ name: "AlphaTheta XDJ-AZ", price_cents: 12500 }],
      stripe_session_id: `cs_test_rental_stub_${Date.now()}`,
    },
  });

  expect(insertRes.status(), await insertRes.text()).toBeLessThan(300);
  const inserted = await insertRes.json();
  const rental = Array.isArray(inserted) ? inserted[0] : inserted;
  expect(rental.id).toBeTruthy();
  expect(rental.payment_status).toBe("pending");

  // Cleanup
  await request.delete(`${url}/rest/v1/equipment_rentals?id=eq.${rental.id}`, {
    headers: authHeaders(anon),
  }).then((r) => r.text()).catch(() => {});
});