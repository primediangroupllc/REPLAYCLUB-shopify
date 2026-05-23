import { test, expect } from "@playwright/test";

/**
 * Booking deep-link gates anonymous users to auth — smoke test confirming
 * the booking modal cannot be opened without sign-in. Hitting
 * /?book=dj as an anonymous user must redirect to /auth (the Sign In
 * page). This is a deliberate auth gate, not a bug.
 *
 * A real happy-path booking test (modal open → date pick → tier → pay)
 * requires authenticated credentials, which we don't run in this stub.
 * Tracked separately for the future-flow test that uses a signed-in
 * fixture.
 */
test("anonymous /?book=dj deep-link gates to auth page", async ({ page }) => {
  await page.goto("/?book=dj");

  // Anonymous user → auth gate kicks in. The Sign In heading is reliable.
  await expect(
    page.getByRole("heading", { name: /sign in/i }).first(),
  ).toBeVisible({ timeout: 15_000 });

  // URL should reflect the redirect to /auth (with the booking deep-link
  // preserved as a `next` param so post-login bounces back into the flow).
  await expect(page).toHaveURL(/\/auth/, { timeout: 5_000 });
});