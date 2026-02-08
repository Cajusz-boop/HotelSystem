import { defineConfig, devices } from "@playwright/test";

/**
 * Konfiguracja Playwright E2E dla Hotel PMS.
 * Uruchom aplikację: npm run dev (domyślnie http://localhost:3000)
 * Testy: npx playwright test
 */
export default defineConfig({
  testDir: "./Test",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    navigationTimeout: 30000,
    actionTimeout: 15000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  timeout: 60000,
  expect: { timeout: 10000 },
});
