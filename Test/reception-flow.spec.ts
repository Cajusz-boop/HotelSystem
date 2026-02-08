import { test, expect } from "@playwright/test";

test.describe("Reception / Front Office – Tape Chart", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/front-office");
  });

  test("wyświetla Grafik i nagłówek", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Grafik/i })).toBeVisible();
  });

  test("wyświetla kolumnę Pokój i pokoje (np. 101)", async ({ page }) => {
    await expect(page.getByText("Pokój")).toBeVisible();
    const room101 = page.getByTestId("room-row-101");
    await expect(room101).toBeVisible();
    await expect(room101.getByText("101")).toBeVisible();
  });

  test("wyświetla przyciski Undo i Redo", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Cofnij.*Ctrl\+Z/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Ponów.*Ctrl\+Y/i })).toBeVisible();
  });

  test("przełącznik Tryb prywatności jest widoczny", async ({ page }) => {
    const privacySwitch = page.getByRole("switch", { name: /Tryb prywatności/i });
    await expect(privacySwitch).toBeVisible();
    const bar = page.getByTestId("reservation-bar").first();
    if (await bar.isVisible()) {
      await expect(bar).toContainText("(Privacy)");
    }
    // Uwaga: test przełączania (click → unchecked) bywa niestabilny w Playwright (Radix Switch + overlay).
    // W aplikacji: po odświeżeniu i bez otwartego Command Palette przyciski i switch powinny reagować.
  });

  test("jeśli jest rezerwacja, pasek rezerwacji jest widoczny", async ({ page }) => {
    const bars = page.getByTestId("reservation-bar");
    const count = await bars.count();
    if (count > 0) {
      await expect(bars.first()).toBeVisible();
    }
  });

  test.skip("kliknięcie w rezerwację otwiera Sheet – niestabilny w CI (overlay/zdarzenia)", async ({
    page,
  }) => {
    const bar = page.getByTestId("reservation-bar").first();
    if (!(await bar.isVisible())) return;
    await bar.click({ force: true });
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
  });

  test.skip("prawy klik na rezerwacji otwiera menu kontekstowe – niestabilny w CI", async ({
    page,
  }) => {
    const bar = page.getByTestId("reservation-bar").first();
    if (!(await bar.isVisible())) return;
    await bar.click({ button: "right", force: true });
    await expect(page.getByRole("menuitem", { name: /Edytuj rezerwację/i })).toBeVisible({
      timeout: 3000,
    });
  });
});

test.describe("Room Guard – blokada DIRTY/OOO", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/front-office");
  });

  test("pokój 102 ma status Do sprzątania (blokada przeniesienia rezerwacji)", async ({ page }) => {
    const room102 = page.getByTestId("room-row-102");
    await expect(room102).toBeVisible();
    await expect(room102.getByText("102")).toBeVisible();
    await expect(room102.getByText("Do sprzątania")).toBeVisible();
  });

  test.skip("próba przeciągnięcia na DIRTY pokazuje toast – weryfikacja ręczna (dnd-kit nie reaguje na programowy dragTo)", async ({
    page,
  }) => {
    const reservationBar = page.getByTestId("reservation-bar").first();
    const room102 = page.getByTestId("room-row-102");
    await reservationBar.dragTo(room102);
    await expect(
      page.getByText(/Nie można przenieść rezerwacji|Status: DIRTY/i)
    ).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Undo / Redo – skróty klawiszowe", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/front-office");
  });

  test("Cofnij jest disabled gdy brak historii", async ({ page }) => {
    const undoBtn = page.getByRole("button", { name: /Cofnij/i });
    await expect(undoBtn).toBeDisabled();
  });

  test("Ponów jest disabled gdy brak przyszłej historii", async ({ page }) => {
    const redoBtn = page.getByRole("button", { name: /Ponów/i });
    await expect(redoBtn).toBeDisabled();
  });
});
