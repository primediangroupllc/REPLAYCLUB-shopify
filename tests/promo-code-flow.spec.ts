import { test, expect } from "@playwright/test";

/**
 * Promo code flow — validates that validate-promo-token rejects an invalid
 * token cleanly, and that the /promo/redeem route renders.
 */
test("validate-promo-token rejects invalid token", async ({ request }) => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
  test.skip(!supabaseUrl || !anonKey, "Supabase env not configured");

  const res = await request.post(`${supabaseUrl}/functions/v1/validate-promo-token`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    data: { token: "invalid-token-xyz-123" },
  });

  // Edge function should return 4xx, not crash with 5xx.
  expect(res.status()).toBeGreaterThanOrEqual(400);
  expect(res.status()).toBeLessThan(500);
  await res.text();
});

test("promo redeem page renders with invalid token", async ({ page }) => {
  await page.goto("/promo/redeem?token=invalid-test-token");
  // Page should render an error/invalid state, not a blank screen.
  await expect(page.locator("body")).toContainText(/invalid|expired|not found|promo/i, {
    timeout: 15_000,
  });
});