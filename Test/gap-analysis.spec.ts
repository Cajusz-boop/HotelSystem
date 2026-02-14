import { test, expect } from "@playwright/test";

/**
 * Testy Gap Analysis – wykrywanie braków funkcjonalnych (GAP-ANALYSIS-TEST-PLAN.md).
 * Testy sprawdzają, czy oczekiwane funkcje są obecne w UI.
 * Gdy test failuje = zidentyfikowana luka (brak funkcji).
 */

test.describe("Gap Analysis – Tape Chart: nawigacja w czasie", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/front-office");
    await expect(page.getByRole("heading", { name: /Grafik|Tape Chart/i })).toBeVisible({ timeout: 5000 });
  });

  test("GAP 1.1: Czy użytkownik może przejść do innego miesiąca (np. maj) – przycisk / wybór daty?", async ({
    page,
  }) => {
    const goToDate = page.getByRole("button", {
      name: /idź do daty|następny miesiąc|wybierz miesiąc|maj|nawiguj/i,
    });
    await expect(goToDate.first()).toBeVisible({ timeout: 2000 });
  });

  test("GAP 1.1: Czy istnieje przewijanie poziome – obszar grafiku ma overflow (scroll na wiele dni)?", async ({
    page,
  }) => {
    const gridWrapper = page.locator(".overflow-auto").first();
    await expect(gridWrapper).toBeVisible();
    await expect(gridWrapper).toHaveAttribute("class", /overflow-auto/);
  });

  test("GAP 1.2: Czy nagłówki dni są sticky (widoczne przy przewijaniu)?", async ({ page }) => {
    const stickyHeader = page.locator(".sticky.top-0").first();
    await expect(stickyHeader).toBeVisible();
  });

  test("GAP 1.2: Czy kolumna 'Room Number' jest sticky (widoczna przy przewijaniu w prawo)?", async ({
    page,
  }) => {
    const roomLabel = page.getByText("Room Number");
    await expect(roomLabel).toBeVisible();
    const parent = page.locator(".sticky.left-0").first();
    await expect(parent).toBeVisible();
  });
});

test.describe("Gap Analysis – Meldunek: wybór dat i pokoju", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/check-in");
    await expect(page.getByRole("heading", { name: /Meldunek gościa/i })).toBeVisible({
      timeout: 5000,
    });
  });

  test("GAP 2.1: Czy użytkownik może wybrać datę zameldowania (pole typu date)?", async ({
    page,
  }) => {
    const checkInDate = page.locator('input[type="date"]').first();
    await expect(checkInDate).toBeVisible({ timeout: 2000 });
  });

  test("GAP 2.1: Czy użytkownik może wybrać pokój z listy (select / wolne pokoje)?", async ({
    page,
  }) => {
    const roomSelect = page.getByRole("combobox");
    const roomLabel = page.getByLabel(/pokój|numer pokoju|wybierz pokój/i);
    const hasSelect = await roomSelect.first().isVisible().catch(() => false);
    const hasRoomField = await roomLabel.first().isVisible().catch(() => false);
    expect(hasSelect || hasRoomField).toBeTruthy();
  });
});

test.describe("Gap Analysis – Finance: Void i audyt", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/finance");
    await expect(page.getByRole("heading", { name: /Finance/i }).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("GAP 3.2: Czy przy Void użytkownik może wybrać transakcję z listy (nie tylko wpisać ID)?", async ({
    page,
  }) => {
    const hasTable = await page.getByRole("table").first().isVisible().catch(() => false);
    const hasListbox = await page.getByRole("listbox").first().isVisible().catch(() => false);
    const hasListText = await page
      .getByText(/lista transakcji|wybierz transakcję/i)
      .first()
      .isVisible()
      .catch(() => false);
    expect(hasTable || hasListbox || hasListText).toBeTruthy();
  });
});

test.describe("Gap Analysis – Dashboard: data kontekstu", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("GAP 5.1: Czy na Dashboardzie widać, za jaki dzień są dane (np. 'Dane na dzień …')?", async ({
    page,
  }) => {
    const dateContext = page.getByText(/dane na dzień|na dzień \d|aktualność|dziś jest/i);
    await expect(dateContext.first()).toBeVisible({ timeout: 2000 });
  });
});

test.describe("Gap Analysis – Raporty: eksport", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/reports");
    await expect(page.getByText(/Raporty|Management Report/i).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("GAP 6.1: Czy raport można wyeksportować (CSV / Excel) oprócz druku?", async ({
    page,
  }) => {
    const exportBtn = page.getByRole("button", { name: /eksport|CSV|Excel|pobierz.*csv/i });
    const exportLink = page.getByRole("link", { name: /eksport|pobierz.*csv/i });
    const hasBtn = await exportBtn.first().isVisible().catch(() => false);
    const hasLink = await exportLink.first().isVisible().catch(() => false);
    expect(hasBtn || hasLink).toBeTruthy();
  });
});

test.describe("Gap Analysis – Tape Chart: drukowanie / eksport", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/front-office");
    await expect(page.getByRole("heading", { name: /Grafik|Tape Chart/i })).toBeVisible({ timeout: 5000 });
  });

  test("GAP 1.4: Czy można wydrukować lub wyeksportować (PDF) fragment grafiku?", async ({
    page,
  }) => {
    const printOrExport = page.getByRole("button", { name: /drukuj|eksport|PDF|zapisz/i });
    await expect(printOrExport.first()).toBeVisible({ timeout: 2000 });
  });
});

/**
 * TC-GAP-01 – TC-GAP-04: Scenariusze z planu testów (GAP-ANALYSIS-TEST-PLAN).
 * ID, Scenariusz, Źródło luki, Typ testu.
 */
test.describe("TC-GAP-01 – TC-GAP-04 (Tape Chart – scenariusze z planu)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/front-office");
    await expect(page.getByRole("heading", { name: /Grafik|Tape Chart/i })).toBeVisible({ timeout: 5000 });
  });

  test("TC-GAP-01 [Gap 1.2] Visual/Manual: Sticky Headers przy scrollowaniu – nagłówki dni i kolumna pokoi pozostają widoczne", async ({
    page,
  }) => {
    const scrollArea = page.locator(".overflow-auto").first();
    await expect(scrollArea).toBeVisible();
    const stickyDayHeader = page.locator(".sticky.top-0").first();
    const stickyRoomColumn = page.locator(".sticky.left-0").first();
    await expect(stickyDayHeader).toBeVisible();
    await expect(stickyRoomColumn).toBeVisible();
    await expect(page.getByText("Room Number")).toBeVisible();
    await scrollArea.evaluate((el) => {
      el.scrollTop = 200;
      el.scrollLeft = 400;
    });
    await page.waitForTimeout(100);
    await expect(stickyDayHeader).toBeVisible();
    await expect(stickyRoomColumn).toBeVisible();
    await expect(page.getByText("Room Number")).toBeVisible();
  });

  test("TC-GAP-02 [Gap 1.1] E2E: Nawigacja do odległej daty – przejście +6 miesięcy, dane się doczytują", async ({
    page,
  }) => {
    const nextMonthBtn = page.getByRole("button", { name: /Następny miesiąc/i });
    await expect(nextMonthBtn).toBeVisible();
    for (let i = 0; i < 6; i++) {
      await nextMonthBtn.click();
      await page.waitForTimeout(150);
    }
    const dayHeaders = page.locator(".sticky.top-0");
    await expect(dayHeaders.first()).toBeVisible();
    const gridWrapper = page.locator(".overflow-auto").first();
    await expect(gridWrapper).toBeVisible();
  });

  test("TC-GAP-03 [Gap 1.3] E2E: Kontekstowe wyszukiwanie – Command Palette „Pokaż na grafiku” scrolluje do rezerwacji", async ({
    page,
  }) => {
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 3000 });
    const searchInput = page.getByPlaceholder(/Szukaj gościa|pokoju|akcję/i);
    await searchInput.fill("Kowalski");
    await page.waitForTimeout(300);
    const showOnChart = page.getByRole("option", { name: /Pokaż na grafiku|Show on chart/i }).first();
    await expect(showOnChart).toBeVisible({ timeout: 2000 });
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/front-office/, { timeout: 5000 });
    await expect(page).toHaveURL(/reservationId=/, { timeout: 3000 });
    await page.waitForTimeout(1500);
    const highlighted = page.locator(
      "[data-highlighted-reservation='true'], [data-reservation-id]"
    ).first();
    await expect(highlighted).toBeVisible({ timeout: 5000 });
  });

  test("TC-GAP-04 [Gap 1.4] Manual/Smoke: Drukowanie/Eksport – podgląd zawiera widok Gantta i widoczne rezerwacje", async ({
    page,
  }) => {
    await page.evaluate(() => {
      window.print = () => {};
    });
    const printBtn = page.getByRole("button", { name: /Drukuj|Eksport PDF|drukuj/i });
    await expect(printBtn.first()).toBeVisible();
    await printBtn.first().click();
    await page.waitForTimeout(200);
    await expect(page.getByText("Room Number")).toBeVisible();
    const hasChart = await page
      .locator("[data-testid='room-row-101'], [data-testid='reservation-bar']")
      .first()
      .isVisible()
      .catch(() => false);
    expect(hasChart).toBeTruthy();
  });
});
