import { test, expect } from "@playwright/test";

test.describe("Finance – Cash Security", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/finance");
    await page.getByText(/Zamknięcie doby|Ślepe rozliczenie|Finanse/i).first().waitFor({ state: "visible", timeout: 20000 }).catch(() => null);
  });

  test("strona Finance wyświetla nagłówek", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Finance|Finanse/i }).first()).toBeVisible({ timeout: 20000 });
  });

  test("sekcja Night Audit (Zamknięcie doby) jest widoczna", async ({ page }) => {
    await expect(page.getByText(/Night Audit|Zamknięcie doby/i)).toBeVisible({ timeout: 20000 });
    await expect(
      page.getByRole("button", { name: /Zamknij dobę|Zamykanie/i })
    ).toBeVisible();
  });

  test("sekcja Blind Drop (Zamknięcie zmiany) jest widoczna", async ({ page }) => {
    await expect(page.getByText(/Ślepe rozliczenie|Blind Drop|Zamknięcie zmiany|zamknięcie zmiany/i)).toBeVisible({ timeout: 20000 });
    await expect(page.getByLabel(/Policzona gotówka/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Zatwierdź i pokaż różnicę|Sprawdzanie/i })
    ).toBeVisible();
  });

  test("Blind Drop – wpisanie kwoty i zatwierdzenie pokazuje wynik (manko/superata)", async ({
    page,
  }) => {
    const input = page.locator("#countedCash");
    await input.waitFor({ state: "visible", timeout: 15000 });
    await input.fill("100");
    await page.getByRole("button", { name: /Zatwierdź i pokaż różnicę/i }).click();
    await expect(
      page.getByText(/Manko|Superata|Oczekiwano|Wprowadzono/i)
    ).toBeVisible({ timeout: 10000 });
  });

  test("sekcja Void Security jest widoczna (PIN Managera)", async ({ page }) => {
    await expect(page.getByText(/Anulowanie transakcji|Void Security|PIN managera/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByLabel("PIN managera")).toBeVisible();
  });

  test("FIN-06: Void – pusty PIN lub ID transakcji – komunikat błędu", async ({ page }) => {
    const voidBtn = page.getByRole("button", { name: /Anuluj transakcję.*void/i });
    await voidBtn.waitFor({ state: "visible", timeout: 15000 });
    await voidBtn.click();
    await expect(
      page.getByText(/Wprowadź ID transakcji i PIN|Wprowadź.*PIN/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test("FIN-08: Night Audit – klik Zamknij dobę – toast z informacją o zamknięciu", async ({
    page,
  }) => {
    const auditBtn = page.getByRole("button", { name: /Zamknij dobę/i });
    await auditBtn.waitFor({ state: "visible", timeout: 15000 });
    await auditBtn.click();
    await expect(
      page.getByText(/Zamknięto dobę|Transakcji:|zamknięto/i)
    ).toBeVisible({ timeout: 20000 });
  });
});
