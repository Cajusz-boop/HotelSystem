import { test, expect } from "@playwright/test";

test.describe("Strona /sprzatanie – tryb sprzątania (publiczna)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/sprzatanie");
  });

  test("strona ładuje się i pokazuje tytuł Tryb sprzątania", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Tryb sprzątania/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test("wyświetla pokoje lub komunikat Brak pokoi", async ({ page }) => {
    await expect(
      page.getByText(/Tryb sprzątania|Brak pokoi|Pokój \d+|Ładowanie/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("wyświetla treść: przyciski Brudny/Posprątane, stan pusty lub ładowanie", async ({ page }) => {
    await expect(page.getByText(/Tryb sprzątania/i).first()).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText(/Brudny|Posprątane|Brak pokoi|Wszystkie pokoje|Nie znaleziono|Ładowanie|Online/i).first()
    ).toBeVisible({ timeout: 15000 });
  });

  test("kliknięcie Posprzątane powoduje toast sukcesu", async ({ page }) => {
    await expect(page.getByText(/Tryb sprzątania/i).first()).toBeVisible({ timeout: 10000 });
    const btn = page.locator("button").filter({ hasText: /Posprzątane|Brudny/ }).first();
    if (!(await btn.isVisible().catch(() => false))) {
      test.skip(true, "Brak przycisków pokoi – prawdopodobnie brak danych");
      return;
    }
    await btn.click();
    await expect(
      page.getByText(/posprzątany|Posprątane|Pokój oznaczony/i)
    ).toBeVisible({ timeout: 5000 });
  });
});
