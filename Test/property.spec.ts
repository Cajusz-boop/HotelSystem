import { test, expect } from "@playwright/test";

test.describe("Obsługa wielu obiektów (Property)", () => {
  test("strona Recepcja ładuje się z danymi (tape chart)", async ({ page }) => {
    await page.goto("/front-office/kwhotel", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /Grafik/i })).toBeVisible({ timeout: 10000 });
    const roomLabels = page.locator("[data-room-number]").first();
    await expect(roomLabels.or(page.getByText(/101|102|pokoi/))).toBeVisible({ timeout: 5000 });
  });

  test("sidebar zawiera linki nawigacji (bez PropertySwitcher gdy 1 obiekt)", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("link", { name: /Panel|Recepcja/ })).toBeVisible({ timeout: 5000 });
    const obiektLabel = page.getByText("Obiekt");
    await expect(obiektLabel).not.toBeVisible();
  });
});
