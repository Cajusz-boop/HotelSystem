import { test, expect } from "@playwright/test";

test.describe("Meldunek – Check-in", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/check-in");
  });

  test("strona Meldunek wyświetla nagłówek i formularz", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Meldunek gościa/i })).toBeVisible();
  });

  test("formularz zawiera pola: imię/nazwisko, e-mail, telefon, MRZ", async ({ page }) => {
    await expect(page.getByLabel("Imię i nazwisko")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Telefon")).toBeVisible();
    await expect(page.getByLabel(/Kod MRZ.*dowód.*skaner 2D/i)).toBeVisible();
  });

  test("pole MRZ jest dostępne (Parse & Forget / skaner 2D)", async ({ page }) => {
    await expect(page.locator("#mrz")).toBeVisible();
  });

  test("przycisk Zapisz gościa / Utwórz rezerwację jest widoczny", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: "Zapisz gościa / Utwórz rezerwację" })
    ).toBeVisible();
  });

  test("upload zdjęcia dowodu (Parse & Forget) – przycisk widoczny", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /Wgraj zdjęcie dowodu|Przetwarzanie/i })
    ).toBeVisible();
  });
});
