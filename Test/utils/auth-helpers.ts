import type { Page } from "@playwright/test";

/**
 * Loguje się (admin@hotel.local / admin123).
 * Wymaga: baza zseedowana (npm run db:seed lub db:seed:kwhotel), aplikacja na baseURL.
 */
export async function ensureLoggedIn(page: Page): Promise<void> {
  await page.goto("/front-office", { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.getByLabel(/Email/i).fill("admin@hotel.local");
    await page.getByLabel(/Hasło/i).fill("admin123");
    await page.getByRole("button", { name: /Zaloguj/i }).click();
    await page.waitForLoadState("networkidle");
    if (page.url().includes("/login")) {
      await page.goto("/front-office", { waitUntil: "networkidle" });
    }
  }
}
