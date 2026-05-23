import { defineConfig, devices } from "@playwright/test";

/**
 * Local-friendly Playwright config for running E2E tests from the sandbox
 * without depending on the CI-only `lovable-agent-playwright-config` package.
 *
 * Usage:
 *   npx playwright test --config=playwright.local.config.ts
 *
 * Override the target URL with PLAYWRIGHT_BASE_URL, e.g.:
 *   PLAYWRIGHT_BASE_URL=http://localhost:8080 npx playwright test --config=playwright.local.config.ts
 */

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ||
  "https://id-preview--85a9ba21-116e-4c02-a805-60fc976988fb.lovable.app";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 13"] },
    },
  ],
});