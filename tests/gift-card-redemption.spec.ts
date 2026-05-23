import { test, expect } from "@playwright/test";

/**
 * Gift card validation — confirms validate-gift-card returns 404 for an
 * unknown code and never leaks 5xx errors.
 */
test("validate-gift-card returns 404 for unknown code", async ({ request }) => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
  test.skip(!supabaseUrl || !anonKey, "Supabase env not configured");

  const res = await request.post(`${supabaseUrl}/functions/v1/validate-gift-card`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    data: { code: "GC-DOES-NOT-EXIST-XYZ" },
  });

  expect(res.status()).toBe(404);
  const body = await res.json();
  expect(body.error).toBeTruthy();
});

test("validate-gift-card rejects empty code", async ({ request }) => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
  test.skip(!supabaseUrl || !anonKey, "Supabase env not configured");

  const res = await request.post(`${supabaseUrl}/functions/v1/validate-gift-card`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    data: { code: "" },
  });

  expect(res.status()).toBe(400);
  await res.text();
});