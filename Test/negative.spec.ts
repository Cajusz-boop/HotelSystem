import { test, expect } from "@playwright/test";

/**
 * Master Test Plan: 4.13 Negatywne i brzegowe (NEG-*)
 */
test.describe("Negatywne i brzegowe", () => {
  test("NEG-02: Nowa rezerwacja – pokój nieistniejący (999) – błąd z backendu", async ({
    page,
  }) => {
    await page.goto("/front-office");
    await expect(page.getByRole("heading", { name: /Tape Chart/i })).toBeVisible({ timeout: 5000 });
    const cell = page.getByTestId("cell-106-2026-04-02");
    await expect(cell).toBeVisible({ timeout: 5000 });
    await cell.evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId("create-reservation-guest")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("create-reservation-guest").fill("Gość NEG E2E");
    await page.getByTestId("create-reservation-room").fill("999");
    await page.getByTestId("create-reservation-save").click();
    await expect(
      page.getByText(/nie istnieje|Pokój 999|błąd|error/i)
    ).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Rezerwacja utworzona.")).not.toBeVisible();
  });

  test("NEG-04: Finance Blind Drop – nieprawidłowa kwota (tekst) – walidacja/toast", async ({
    page,
  }) => {
    await page.goto("/finance");
    await expect(page.locator("#countedCash")).toBeVisible({ timeout: 5000 });
    await page.locator("#countedCash").fill("abc");
    await page.getByRole("button", { name: /Zatwierdź i pokaż różnicę/i }).click();
    await expect(
      page.getByText(/Wprowadź poprawną|kwotę|błąd|error/i)
    ).toBeVisible({ timeout: 5000 });
  });
});
