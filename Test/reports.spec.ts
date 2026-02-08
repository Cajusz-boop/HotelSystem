import { test, expect } from "@playwright/test";

/**
 * Master Test Plan: 4.9 Reports (RPT-01–03)
 */
test.describe("Raporty", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/reports");
  });

  test("RPT-01: strona Reports ładuje się; wybór daty i przycisk Pobierz raport", async ({
    page,
  }) => {
    await expect(page.getByText(/Raporty|Management Report/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator("#report-date")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Pobierz raport|Ładowanie/i })
    ).toBeVisible();
  });

  test("RPT-02: wybór daty i Pobierz raport – widoczność raportu lub komunikatu błędu", async ({
    page,
  }) => {
    await expect(page.locator("#report-date")).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /Pobierz raport/ }).click();
    await expect(
      page.getByRole("heading", { name: /Raport dobowy –/ })
    ).toBeVisible({ timeout: 8000 });
  });

  test("RPT-03: raport dla daty z przeszłości – dane lub Brak transakcji", async ({ page }) => {
    const dateInput = page.locator("#report-date");
    await expect(dateInput).toBeVisible({ timeout: 5000 });
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const y = yesterday.getFullYear();
    const m = String(yesterday.getMonth() + 1).padStart(2, "0");
    const d = String(yesterday.getDate()).padStart(2, "0");
    await dateInput.fill(`${y}-${m}-${d}`);
    await page.getByRole("button", { name: /Pobierz raport/ }).click();
    await expect(
      page.getByRole("heading", { name: /Raport dobowy –/ })
    ).toBeVisible({ timeout: 8000 });
  });
});
