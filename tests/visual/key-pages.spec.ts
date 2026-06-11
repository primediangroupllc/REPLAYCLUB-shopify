import { test, expect } from "@playwright/test";

// Advisory visual-regression baseline for Replay Club's key public pages.
//
// Catches layout / asset / CSS regressions — e.g. from the SITE_URL flip and the
// DNS cutover — that backend checks can't see. ADVISORY: diffs are informational
// until the baseline proves stable; this never blocks a deploy.
//
// Runs under chromium only (CI installs chromium, not webkit) at two viewports so
// both desktop and mobile layouts are covered. Point it at any origin with
// PLAYWRIGHT_BASE_URL. Baseline workflow: see tests/visual/README.md.

const ROUTES: Array<{ name: string; path: string }> = [
  { name: "home", path: "/" }, // homepage Deck + Mixes section
  { name: "talent", path: "/talent" },
  { name: "how-it-works", path: "/how-it-works" },
  { name: "dj-studio", path: "/dj-studio" },
  { name: "podcast-studio", path: "/podcast-studio" },
  { name: "music-studio", path: "/music-studio" },
  { name: "livestream-studio", path: "/livestream-studio" },
  { name: "photoshoot", path: "/photoshoot" },
  { name: "events", path: "/events" },
  { name: "shop", path: "/shop" },
  { name: "auth", path: "/auth" },
];

const VIEWPORTS = [
  { label: "desktop", width: 1280, height: 800 },
  { label: "mobile", width: 390, height: 844 },
];

// Webkit isn't installed in CI; keep the visual baseline single-engine.
test.beforeEach(async ({}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile-safari",
    "visual baseline runs under chromium only",
  );
});

for (const vp of VIEWPORTS) {
  test.describe(`visual:${vp.label}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const route of ROUTES) {
      test(route.name, async ({ page }) => {
        await page.goto(route.path, { waitUntil: "load" });
        // Let fonts, lazy images and hero transitions settle before snapping.
        await page.waitForLoadState("networkidle").catch(() => {});
        await page.waitForTimeout(1200);

        await expect(page).toHaveScreenshot(`${route.name}-${vp.label}.png`, {
          fullPage: true,
          // Embeds and media (YouTube/Twitch/video) are inherently dynamic.
          mask: [page.locator("iframe"), page.locator("video")],
          animations: "disabled",
          // Advisory tolerance so minor dynamic noise doesn't cry wolf.
          maxDiffPixelRatio: 0.03,
        });
      });
    }
  });
}
