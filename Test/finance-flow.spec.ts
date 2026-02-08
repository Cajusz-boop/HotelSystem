import { test, expect } from "@playwright/test";

test.describe("Finance – Cash Security", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/finance");
  });

  test("strona Finance wyświetla nagłówek", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Finance/i }).first()).toBeVisible();
  });

  test("sekcja Night Audit (Zamknięcie doby) jest widoczna", async ({ page }) => {
    await expect(page.getByText(/Night Audit|Zamknięcie doby/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Zamknij dobę|Zamykanie/i })
    ).toBeVisible();
  });

  test("sekcja Blind Drop (Zamknięcie zmiany) jest widoczna", async ({ page }) => {
    await expect(page.getByText(/Blind Drop|Zamknięcie zmiany/i)).toBeVisible();
    await expect(page.getByLabel(/Policzona gotówka|countedCash/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Zatwierdź i pokaż różnicę|Sprawdzanie/i })
    ).toBeVisible();
  });

  test("Blind Drop – wpisanie kwoty i zatwierdzenie pokazuje wynik (manko/superata)", async ({
    page,
  }) => {
    const input = page.locator("#countedCash");
    await input.fill("100");
    await page.getByRole("button", { name: /Zatwierdź i pokaż różnicę/i }).click();
    await expect(
      page.getByText(/Manko|Superata|Oczekiwano|Wprowadzono/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test("sekcja Void Security jest widoczna (PIN Managera)", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Void Security" })).toBeVisible();
    await expect(page.getByLabel("PIN managera")).toBeVisible();
  });

  test("FIN-06: Void – pusty PIN lub ID transakcji – komunikat błędu", async ({ page }) => {
    await page.getByRole("button", { name: /Anuluj transakcję \(void\)/i }).click();
    await expect(
      page.getByText(/Wprowadź ID transakcji i PIN|Wprowadź.*PIN/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test("FIN-08: Night Audit – klik Zamknij dobę – toast z informacją o zamknięciu", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /Zamknij dobę/i }).click();
    await expect(
      page.getByText(/Zamknięto dobę|Zamknięto dobę/i)
    ).toBeVisible({ timeout: 15000 });
  });
});
