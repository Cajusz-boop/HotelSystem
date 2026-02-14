import { test, expect } from "@playwright/test";

test.describe("Create Reservation – nowa rezerwacja z Tape Chart", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/front-office");
    await expect(page.getByRole("heading", { name: /Grafik|Tape Chart/i })).toBeVisible({ timeout: 5000 });
  });

  test("Create Reservation: klik w pustą komórkę (Pokój 102, 30 marca) → Gość Jan Testowy, Status Potwierdzona → Zapisz", async ({
    page,
  }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    await expect(page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i })).toBeChecked({ checked: false });

    const cellRoom102March30 = page.getByTestId("cell-102-2026-03-30");
    await expect(cellRoom102March30).toBeVisible({ timeout: 5000 });
    await cellRoom102March30.scrollIntoViewIfNeeded();
    await cellRoom102March30.evaluate((el) => (el as HTMLElement).click());

    await expect(page.getByTestId("create-reservation-guest")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Nowa rezerwacja")).toBeVisible();

    await page.getByTestId("create-reservation-guest").fill("Jan Testowy");
    await page.getByTestId("create-reservation-status").selectOption({ label: "Potwierdzona" });

    await expect(page.getByTestId("create-reservation-room")).toHaveValue("102");
    await expect(page.getByTestId("create-reservation-checkIn")).toHaveValue("2026-03-30");

    await page.getByTestId("create-reservation-save").click();

    await expect(page.getByText("Rezerwacja utworzona.")).toBeVisible({ timeout: 8000 });
    await expect(
      page.getByTestId("reservation-bar").filter({ hasText: "Jan Testowy" }).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("CR-04: walidacja – pusty Gość, Zapisz nie tworzy rezerwacji (brak toastu sukcesu)", async ({
    page,
  }) => {
    const cell = page.getByTestId("cell-102-2026-02-20");
    await expect(cell).toBeVisible({ timeout: 5000 });
    await cell.evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId("create-reservation-guest")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("create-reservation-guest").fill("");
    await page.getByTestId("create-reservation-save").click();
    await expect(page.getByText("Rezerwacja utworzona.")).not.toBeVisible({ timeout: 3000 });
    await expect(page.getByText("Nowa rezerwacja")).toBeVisible();
  });

  test("CR-04b: rezerwacja z miejscem parkingowym → wybór P-01 → zapis → parking widoczny w grafiku", async ({
    page,
  }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const cell = page.getByTestId("cell-102-2026-02-16");
    await expect(cell).toBeVisible({ timeout: 5000 });
    await cell.scrollIntoViewIfNeeded();
    await cell.evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId("create-reservation-guest")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("create-reservation-guest").fill("Gość z Parkingiem");
    await page.getByTestId("create-reservation-parking").selectOption({ label: "P-01" });
    await page.getByTestId("create-reservation-save").click();
    await expect(page.getByText("Rezerwacja utworzona.")).toBeVisible({ timeout: 8000 });
    const bar = page.getByTestId("reservation-bar").filter({ hasText: "Gość z Parkingiem" }).first();
    await expect(bar).toBeVisible({ timeout: 5000 });
    await bar.click();
    await expect(page.getByText("Edycja rezerwacji")).toBeVisible({ timeout: 3000 });
    await expect(page.locator("#parking")).toHaveValue(/./);
    const parkingSelect = page.locator("#parking");
    const val = await parkingSelect.inputValue();
    expect(val).toBeTruthy();
  });

  test("CR-05: Anuluj zamyka Sheet bez zapisu", async ({ page }) => {
    const cell = page.getByTestId("cell-102-2026-02-22");
    await expect(cell).toBeVisible({ timeout: 5000 });
    await cell.evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByText("Nowa rezerwacja")).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: "Anuluj" }).click();
    await expect(page.getByText("Nowa rezerwacja")).not.toBeVisible({ timeout: 2000 });
  });

  test("SCENARIO: Obsługa klawiatury – N otwiera formularz nowej rezerwacji", async ({ page }) => {
    await page.keyboard.press("n");
    await expect(page.getByText("Nowa rezerwacja").or(page.getByTestId("create-reservation-guest"))).toBeVisible({ timeout: 3000 });
  });
});
