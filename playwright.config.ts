import { defineConfig, devices } from "@playwright/test";

/**
 * Konfiguracja Playwright E2E dla Hotel PMS.
 * Uruchom aplikację: npm run dev (port 3011)
 * Seed: npm run db:seed:kwhotel
 * Testy: npx playwright test tests/reception-e2e.spec.ts --reporter=list
 */
export default defineConfig({
  testDir: ".",
  testMatch: ["**/Test/**/*.spec.ts", "**/tests/**/*.spec.ts"],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  globalSetup: "./playwright.global-setup.ts",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3011",
    storageState: ".auth/user.json",
    trace: "on-first-retry",
    screenshot: "on",
    video: "retain-on-failure",
    navigationTimeout: 30000,
    actionTimeout: 15000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  timeout: 90000,
  expect: { timeout: 10000 },
});
