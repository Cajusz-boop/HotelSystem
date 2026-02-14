import { test, expect } from "@playwright/test";

test.describe("Booking Engine – strona /booking", () => {
  test("strona booking się ładuje i pokazuje formularz wyszukiwania", async ({
    page,
  }) => {
    await page.goto("/booking");
    await expect(page).toHaveURL(/\/booking/);
    await expect(
      page.getByRole("heading", { name: /Rezerwacja online/i })
    ).toBeVisible();
    await expect(page.getByLabel(/Zameldowanie/i)).toBeVisible();
    await expect(page.getByLabel(/Wymeldowanie/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Szukaj/i })).toBeVisible();
  });

  test("po wpisaniu dat i kliknięciu Szukaj wyświetla się lista lub komunikat", async ({
    page,
  }) => {
    await page.goto("/booking");
    const checkIn = page.getByLabel(/Zameldowanie/i);
    const checkOut = page.getByLabel(/Wymeldowanie/i);
    await checkIn.fill("2030-06-01");
    await checkOut.fill("2030-06-03");
    await page.getByRole("button", { name: /Szukaj/i }).click();
    await page.waitForTimeout(2000);
    const resultsOrError = await page
      .getByText(/Dostępne pokoje|Brak dostępnych|Szukam/)
      .first()
      .isVisible()
      .catch(() => false);
    expect(
      resultsOrError ||
        (await page.getByRole("button", { name: /Złóż rezerwację|Wybierz|Inne daty/ }).isVisible().catch(() => false))
    ).toBeTruthy();
  });
});
