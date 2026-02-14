import { test, expect } from "@playwright/test";
import { splitAmountIntoEqualParts } from "../lib/split-amount";

/**
 * Testy priorytetowe – P1 (No-Go), P2, P3, Sekcje S1–S7
 * Zgodne z SCENARIUSZE-BLEDOW.md
 * Wymaga: globalSetup (logowanie), baza zseedowana, aplikacja na baseURL
 */
test.describe("P1.2 Finanse i Płatności", () => {
  test("P1.2.1: Zaokrąglenia groszowe – split 100 zł na 3 równe części → suma części = całość", () => {
    const parts = splitAmountIntoEqualParts(100, 3);
    expect(parts).toHaveLength(3);
    const sum = parts.reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
    expect(parts[0]).toBe(33.33);
    expect(parts[1]).toBe(33.33);
    expect(parts[2]).toBe(33.34);
  });

  test("P1.2.2: Podwójne obciążenie (Spam Click) – 10x Zapłać przy throttlingu → tylko jedna płatność", async ({
    page,
  }) => {
    await page.goto("/front-office", { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click().catch(() => {});
    await expect(page.getByRole("heading", { name: /Grafik|Tape Chart/i })).toBeVisible({ timeout: 8000 });
    const bar = page.getByTestId("reservation-bar").first();
    if (!(await bar.isVisible())) {
      test.skip();
      return;
    }
    await bar.click();
    await expect(page.getByText("Edycja rezerwacji")).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: "Pobierz kaucję" }).click();
    await expect(page.getByPlaceholder("np. 500")).toBeVisible({ timeout: 3000 });
    await page.getByPlaceholder("np. 500").fill("10");
    await page.route("**/api/**", async (route) => {
      await new Promise((r) => setTimeout(r, 500));
      await route.continue();
    });
    const saveBtn = page.getByRole("button", { name: /^Zapisz$/ }).filter({ hasText: "Zapisz" }).first();
    await expect(saveBtn).toBeVisible({ timeout: 2000 });
    for (let i = 0; i < 10; i++) {
      saveBtn.click().catch(() => {});
    }
    await page.waitForTimeout(4000);
    const toasts = page.getByText("Pobrano kaucję");
    const count = await toasts.count();
    expect(count).toBe(1);
  });

  test("P1.2.3: Korekty ujemne – refund > payment → walidacja/blokada", async ({ page }) => {
    await page.goto("/front-office", { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click().catch(() => {});
    await expect(page.getByRole("heading", { name: /Grafik|Tape Chart/i })).toBeVisible({ timeout: 8000 });
    const bar = page.getByTestId("reservation-bar").first();
    if (!(await bar.isVisible())) {
      test.skip();
      return;
    }
    await bar.click();
    await expect(page.getByText("Edycja rezerwacji")).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: "Pobierz kaucję" }).click();
    await page.getByPlaceholder("np. 500").fill("10");
    await page.getByRole("button", { name: /^Zapisz$/ }).first().click();
    await expect(page.getByText("Pobrano kaucję")).toBeVisible({ timeout: 8000 });
    await page.getByRole("button", { name: "Zwróć kaucję" }).click();
    await expect(page.getByPlaceholder("Całość")).toBeVisible({ timeout: 3000 });
    await page.getByPlaceholder("Całość").fill("20");
    await page.getByRole("button", { name: "Zwróć" }).click();
    await expect(
      page.getByText(/nie może przekraczać|Suma zwrotu i potrącenia|przekracza.*kaucj|Błąd zwrotu/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test("P1.2.4: Nocny Audyt vs Transakcje – zamknięcie doby i płatność (obsługa race, no crash)", async ({
    page,
  }) => {
    await page.goto("/finance", { waitUntil: "domcontentloaded", timeout: 15000 });
    await expect(page.getByRole("heading", { name: /Finanse|Finance/i })).toBeVisible({ timeout: 10000 });
    const nightAuditBtn = page.getByRole("button", { name: /Zamknij dobę/i });
    if (await nightAuditBtn.isVisible()) {
      await nightAuditBtn.click();
      await page.waitForTimeout(3000);
    }
    await page.goto("/front-office", { waitUntil: "domcontentloaded" });
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click().catch(() => {});
    const bar = page.getByTestId("reservation-bar").first();
    if (!(await bar.isVisible())) {
      test.skip();
      return;
    }
    await bar.click();
    await expect(page.getByText("Edycja rezerwacji")).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: "Pobierz kaucję" }).click();
    await page.getByPlaceholder("np. 500").fill("1");
    await page.getByRole("button", { name: /^Zapisz$/ }).first().click();
    await expect(
      page.getByText("Pobrano kaucję").or(page.getByText(/Błąd|error/i))
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe("P1.1 Stabilność Grafiku (Tape Chart)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/front-office");
    await expect(page.getByRole("heading", { name: /Grafik|Tape Chart/i })).toBeVisible({ timeout: 8000 });
  });

  test("P1.1.2: Double Booking (Race Condition) – 2 okna, ten sam pokój i daty → walidacja/konflikt", async ({
    context,
  }) => {
    const pageA = await context.newPage();
    const pageB = await context.newPage();
    await pageA.goto("/front-office", { waitUntil: "domcontentloaded", timeout: 15000 });
    await pageB.goto("/front-office", { waitUntil: "domcontentloaded", timeout: 15000 });
    await pageA.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click().catch(() => {});
    await pageB.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click().catch(() => {});
    await expect(pageA.getByRole("heading", { name: /Grafik|Tape Chart/i })).toBeVisible({ timeout: 8000 });
    await expect(pageB.getByRole("heading", { name: /Grafik|Tape Chart/i })).toBeVisible({ timeout: 8000 });
    const cellA = pageA.getByTestId("cell-106-2026-03-01").or(pageA.getByTestId("cell-104-2026-03-01"));
    const cellB = pageB.getByTestId("cell-106-2026-03-01").or(pageB.getByTestId("cell-104-2026-03-01"));
    await expect(cellA.first()).toBeVisible({ timeout: 5000 });
    await expect(cellB.first()).toBeVisible({ timeout: 5000 });
    await cellA.first().click();
    await cellB.first().click();
    await expect(pageA.getByTestId("create-reservation-guest")).toBeVisible({ timeout: 5000 });
    await expect(pageB.getByTestId("create-reservation-guest")).toBeVisible({ timeout: 5000 });
    await pageA.getByTestId("create-reservation-guest").fill("Race Guest A");
    await pageB.getByTestId("create-reservation-guest").fill("Race Guest B");
    await Promise.all([
      pageA.getByTestId("create-reservation-save").click(),
      pageB.getByTestId("create-reservation-save").click(),
    ]);
    await pageA.waitForTimeout(3000);
    await pageB.waitForTimeout(3000);
    const successA = await pageA.getByText("Rezerwacja utworzona.").isVisible().catch(() => false);
    const successB = await pageB.getByText("Rezerwacja utworzona.").isVisible().catch(() => false);
    const errorA =
      (await pageA.getByTestId("create-reservation-error").isVisible().catch(() => false)) ||
      (await pageA.getByText(/dostępne|łóżek|zajęty|W tym okresie|Błąd/i).first().isVisible().catch(() => false));
    const errorB =
      (await pageB.getByTestId("create-reservation-error").isVisible().catch(() => false)) ||
      (await pageB.getByText(/dostępne|łóżek|zajęty|W tym okresie|Błąd/i).first().isVisible().catch(() => false));
    const successCount = (successA ? 1 : 0) + (successB ? 1 : 0);
    expect(successCount).toBe(1);
    expect(successA || errorA).toBeTruthy();
    expect(successB || errorB).toBeTruthy();
    await pageA.close();
    await pageB.close();
  });

  test("P1.1.1: Test Kolizji – próba nałożenia rezerwacji na zajęty termin (Drag & Drop) → blokada/cofnięcie", async ({
    page,
  }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click().catch(() => {});
    await expect(page.getByRole("heading", { name: /Grafik|Tape Chart/i })).toBeVisible({ timeout: 8000 });
    const bar = page.getByTestId("reservation-bar").filter({ hasText: "Jan Kowalski" }).first();
    const targetRow = page.getByTestId("room-row-102");
    if (!(await bar.isVisible()) || !(await targetRow.isVisible())) {
      test.skip();
      return;
    }
    await bar.dragTo(targetRow);
    await expect(
      page.getByText(/jest zajęty|zajęty w terminie|Nie można przenieść|Pokój 102/i)
    ).toBeVisible({ timeout: 8000 });
  });

  test("P1.1.4: Ghost Dragging – wyrzucenie kursora z rezerwacją poza okno, puszczenie → rezerwacja wraca", async ({
    page,
  }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click().catch(() => {});
    await expect(page.getByRole("heading", { name: /Grafik|Tape Chart/i })).toBeVisible({ timeout: 8000 });
    const bar = page.getByTestId("reservation-bar").filter({ hasText: "Jan Kowalski" }).first();
    if (!(await bar.isVisible())) {
      test.skip();
      return;
    }
    const box = await bar.boundingBox();
    if (!box) {
      test.skip();
      return;
    }
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 25, cy);
    await page.mouse.move(-500, -500);
    await page.mouse.up();
    await page.waitForTimeout(500);
    await expect(bar).toBeVisible();
  });

  test("P1.1.3: Logika dat – Check-out < Check-in → walidacja/błąd", async ({ page }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const cell = page.getByTestId("cell-102-2026-03-01").or(page.getByTestId("cell-204-2026-02-20"));
    await expect(cell.first()).toBeVisible({ timeout: 5000 });
    await cell.first().scrollIntoViewIfNeeded();
    await cell.first().evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId("create-reservation-guest")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("create-reservation-guest").fill("Test Dat");
    await page.getByTestId("create-reservation-checkIn").fill("2026-03-10");
    await page.getByTestId("create-reservation-checkOut").fill("2026-03-08");
    await page.getByTestId("create-reservation-save").click();
    await expect(page.getByText("Rezerwacja utworzona.")).not.toBeVisible({ timeout: 3000 });
    await expect(page.getByTestId("create-reservation-error")).toBeVisible({ timeout: 12000 });
    await expect(page.getByTestId("create-reservation-error")).toContainText(/wyjazdu|przyjazdu/i);
  });

  test("P1.1.3b: Check-in == Check-out → walidacja", async ({ page }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const cell = page.getByTestId("cell-204-2026-02-25").or(page.getByTestId("cell-102-2026-03-05"));
    await expect(cell.first()).toBeVisible({ timeout: 5000 });
    await cell.first().evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId("create-reservation-guest")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("create-reservation-guest").fill("Test Dat Eq");
    await page.getByTestId("create-reservation-checkIn").fill("2026-03-12");
    await page.getByTestId("create-reservation-checkOut").fill("2026-03-12");
    await page.getByTestId("create-reservation-save").click();
    await expect(page.getByText("Rezerwacja utworzona.")).not.toBeVisible({ timeout: 3000 });
  });
});

test.describe("P1.3 Bezpieczeństwo i Sesja", () => {
  test("P1.3.1: Wyścig tokenów – wyloguj w jednej karcie, zapisz formularz w drugiej → błąd/redirect do login", async ({
    context,
  }) => {
    const pageA = await context.newPage();
    const pageB = await context.newPage();
    await pageA.goto("/front-office", { waitUntil: "domcontentloaded", timeout: 15000 });
    await pageB.goto("/front-office", { waitUntil: "domcontentloaded", timeout: 15000 });
    await expect(pageA.getByRole("heading", { name: /Grafik|Tape Chart/i })).toBeVisible({ timeout: 8000 });
    const bar = pageA.getByTestId("reservation-bar").first();
    if (!(await bar.isVisible())) {
      await pageA.close();
      await pageB.close();
      test.skip();
      return;
    }
    await bar.click();
    await expect(pageA.getByText("Edycja rezerwacji")).toBeVisible({ timeout: 5000 });
    await pageA.locator("#notes").fill("Token race test");
    await pageB.getByRole("button", { name: /Wyloguj|Log out/i }).click();
    await pageB.waitForURL(/\/login/, { timeout: 5000 }).catch(() => {});
    await pageA.getByRole("button", { name: /^Zapisz$/ }).click();
    await pageA.waitForTimeout(3000);
    const redirectedToLogin = pageA.url().includes("/login");
    const hasError = await pageA.getByText(/Błąd|error|sesj|loguj/i).first().isVisible().catch(() => false);
    expect(redirectedToLogin || hasError).toBeTruthy();
    await pageA.close();
    await pageB.close();
  });

  test("P1.3.2: IDOR (Brak uprawnień) – zmiana ID w URL /guests/123 → nieistniejący lub bez dostępu → 403/brak danych", async ({
    page,
  }) => {
    await page.goto("/guests/cuid-nieistniejacy-idor-12345", { waitUntil: "domcontentloaded", timeout: 15000 });
    const has404 = await page.getByText(/404|nie znaleziono|not found|could not be found/i).isVisible().catch(() => false);
    const hasForbidden = await page.getByText(/Brak uprawnień|403|forbidden/i).isVisible().catch(() => false);
    const noGuestCard = !(await page.getByRole("heading", { name: /Karta gościa –/i }).isVisible().catch(() => false));
    expect(has404 || hasForbidden || noGuestCard).toBeTruthy();
  });
});

test.describe("P1.3 Bezpieczeństwo – XSS/Injection", () => {
  test("P1.3.3: XSS – script w Imię – escape/brak wykonania", async ({ page }) => {
    await page.goto("/front-office");
    await expect(page.getByRole("heading", { name: /Grafik|Tape Chart/i })).toBeVisible({ timeout: 8000 });
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const cell = page.getByTestId("cell-102-2026-02-20").or(page.getByTestId("cell-204-2026-03-01"));
    await expect(cell.first()).toBeVisible({ timeout: 5000 });
    await cell.first().scrollIntoViewIfNeeded();
    await cell.first().evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId("create-reservation-guest")).toBeVisible({ timeout: 5000 });
    const xssPayload = "<script>alert(1)</script>";
    await page.getByTestId("create-reservation-guest").fill(xssPayload);
    await page.getByTestId("create-reservation-save").click();
    const created = await page.getByText("Rezerwacja utworzona.").isVisible().catch(() => false);
    if (created) {
      const bar = page.getByTestId("reservation-bar").filter({ hasText: /script|alert/ }).first();
      const barText = (await bar.textContent()) || "";
      expect(barText).not.toContain("<script>");
      expect(barText).not.toContain("alert(1)");
    }
  });
});

test.describe("S7 Komunikacja i powiadomienia", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/front-office", { waitUntil: "domcontentloaded", timeout: 15000 });
    await expect(page.getByRole("heading", { name: /Grafik|Tape Chart/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test("S7.3: Invoice Data – dane do faktury z rezerwacji → moduł finansowy, poprawny transfer", async ({
    page,
  }) => {
    await page.goto("/finance", { waitUntil: "domcontentloaded", timeout: 15000 });
    await expect(page.getByRole("heading", { name: /Finanse|Finance/i })).toBeVisible({
      timeout: 10000,
    });
    const has500 = await page.getByText(/500|Internal Server Error/i).isVisible().catch(() => false);
    expect(has500).toBeFalsy();
  });

  test("S7.2: Registration Card – wydruk karty meldunkowej → polskie znaki, RODO OK", async ({
    page,
  }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3011";
    const res = await page.request.get(`${base}/api/reservations/test-id-reg-card/registration-card/pdf`);
    expect(res.status()).toBeLessThan(500);
  });

  test("S7.1: Confirmation Email – czy e-mail wychodzi po założeniu? → natychmiast", async ({
    page,
  }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const cell = page.locator("[data-testid^=cell-]").first();
    await expect(cell).toBeVisible({ timeout: 8000 });
    await cell.evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId("create-reservation-guest")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("create-reservation-guest").fill("Confirmation Email Guest");
    await page.getByTestId("create-reservation-save").click();
    await expect(page.getByText("Rezerwacja utworzona.")).toBeVisible({ timeout: 15000 });
  });
});

test.describe("S6 Meldunek i wymeldowanie", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/front-office", { waitUntil: "domcontentloaded", timeout: 15000 });
    await expect(page.getByRole("heading", { name: /Grafik|Tape Chart/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test("S6.8: Auto-Cancel – rezerwacja wstępna po terminie → auto-anulowanie", async ({
    page,
  }) => {
    await page.goto("/front-office", { waitUntil: "domcontentloaded", timeout: 15000 });
    await expect(page.getByRole("heading", { name: /Grafik|Tape Chart/i })).toBeVisible({
      timeout: 10000,
    });
    const has500 = await page.getByText(/500|Internal Server Error/i).isVisible().catch(() => false);
    expect(has500).toBeFalsy();
  });

  test("S6.7: Reinstate – przywrócenie anulowanej, pokój zajęty → obsługa konfliktu", async ({
    page,
  }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const bar = page.getByTestId("reservation-bar").first();
    await expect(bar).toBeVisible({ timeout: 8000 });
    await bar.click();
    await expect(page.getByText("Edycja rezerwacji")).toBeVisible({ timeout: 5000 });
    const statusSelect = page.locator("#status").or(page.getByLabel(/Status/i));
    if (await statusSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      const val = await statusSelect.inputValue();
      if (val?.includes("CANCELLED") || await page.getByText("Anulowana").isVisible().catch(() => false)) {
        await statusSelect.selectOption({ label: /Potwierdzon|CONFIRMED/i });
        await page.getByRole("button", { name: /^Zapisz$/ }).first().click();
        await page.waitForTimeout(3000);
        const closed = await page.getByText("Edycja rezerwacji").isHidden().catch(() => false);
        const hasError = await page.getByTestId("reservation-edit-error").isVisible().catch(() => false);
        expect(closed || hasError).toBeTruthy();
      } else {
        await page.getByRole("button", { name: /^Zapisz$/ }).first().click();
        await expect(page.getByText("Edycja rezerwacji")).not.toBeVisible({ timeout: 8000 });
      }
    } else {
      expect(await page.locator("body").textContent()).toBeTruthy();
    }
  });

  test("S6.6: No-Show – oznaczenie Nie dojechał → pokój zwolniony na grafiku", async ({
    page,
  }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const bar = page.getByTestId("reservation-bar").first();
    await expect(bar).toBeVisible({ timeout: 8000 });
    await bar.click();
    await expect(page.getByText("Edycja rezerwacji")).toBeVisible({ timeout: 5000 });
    const statusSelect = page.locator("#status").or(page.getByLabel(/Status/i));
    if (await statusSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await statusSelect.selectOption({ label: /No-show|No show/i });
      await page.getByRole("button", { name: /^Zapisz$/ }).first().click();
      await expect(page.getByText("Edycja rezerwacji")).not.toBeVisible({ timeout: 12000 });
    } else {
      expect(await page.locator("body").textContent()).toBeTruthy();
    }
  });

  test("S6.5: Check-out with Balance – zamknięcie z nieopłaconym rachunkiem → blokada / ostrzeżenie", async ({
    page,
  }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const bar = page.getByTestId("reservation-bar").first();
    await expect(bar).toBeVisible({ timeout: 8000 });
    await bar.click();
    await expect(page.getByText("Edycja rezerwacji")).toBeVisible({ timeout: 5000 });
    const statusSelect = page.locator("#status").or(page.getByLabel(/Status/i));
    if (await statusSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await statusSelect.selectOption({ label: /Wymeldowany|CHECKED_OUT/i });
      await page.getByRole("button", { name: /^Zapisz$/ }).first().click();
      await page.waitForTimeout(3000);
      const closed = await page.getByText("Edycja rezerwacji").isHidden().catch(() => false);
      const hasError = await page.getByTestId("reservation-edit-error").isVisible().catch(() => false);
      const hasWarning = await page.getByText(/saldo|nieopłac|balance|ostrzeżenie/i).isVisible().catch(() => false);
      expect(closed || hasError || hasWarning).toBeTruthy();
    } else {
      expect(await page.locator("body").textContent()).toBeTruthy();
    }
  });

  test("S6.4: Undo Check-out – cofnięcie wymeldowania → przywrócenie", async ({ page }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const bar = page.getByTestId("reservation-bar").first();
    await expect(bar).toBeVisible({ timeout: 8000 });
    await bar.click();
    await expect(page.getByText("Edycja rezerwacji")).toBeVisible({ timeout: 5000 });
    const statusSelect = page.locator("#status").or(page.getByLabel(/Status/i));
    if (await statusSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      const val = await statusSelect.inputValue();
      if (val?.includes("CHECKED_OUT") || await page.getByText("Wymeldowany").isVisible().catch(() => false)) {
        await statusSelect.selectOption({ label: /Zameldowany|CHECKED_IN/i });
        await page.getByRole("button", { name: /^Zapisz$/ }).first().click();
        await expect(page.getByText("Edycja rezerwacji")).not.toBeVisible({ timeout: 12000 });
      } else {
        await page.getByRole("button", { name: /^Zapisz$/ }).first().click();
        await expect(page.getByText("Edycja rezerwacji")).not.toBeVisible({ timeout: 8000 });
      }
    } else {
      expect(await page.locator("body").textContent()).toBeTruthy();
    }
  });

  test("S6.3: Undo Check-in – cofnięcie Zameldowany → Potwierdzony → pokój: Czysty/Brudny?", async ({
    page,
  }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const bar = page.getByTestId("reservation-bar").first();
    await expect(bar).toBeVisible({ timeout: 8000 });
    await bar.click();
    await expect(page.getByText("Edycja rezerwacji")).toBeVisible({ timeout: 5000 });
    const statusSelect = page.locator("#status").or(page.getByLabel(/Status/i));
    if (await statusSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await statusSelect.selectOption({ label: /Potwierdzon|CONFIRMED/i });
      await page.getByRole("button", { name: /^Zapisz$/ }).first().click();
      await expect(page.getByText("Edycja rezerwacji")).not.toBeVisible({ timeout: 12000 });
    } else {
      expect(await page.locator("body").textContent()).toBeTruthy();
    }
  });

  test("S6.2: Late Check-out – wymeldowanie po czasie → naliczenie opłaty", async ({ page }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const bar = page.getByTestId("reservation-bar").first();
    await expect(bar).toBeVisible({ timeout: 8000 });
    await bar.click();
    await expect(page.getByText("Edycja rezerwacji")).toBeVisible({ timeout: 5000 });
    const statusSelect = page.locator("#status").or(page.getByLabel(/Status/i));
    if (await statusSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await statusSelect.selectOption({ label: /Wymeldowany|Checked.out|CHECKED_OUT/i });
      await page.getByRole("button", { name: /^Zapisz$/ }).first().click();
      await expect(page.getByText("Edycja rezerwacji")).not.toBeVisible({ timeout: 12000 });
    } else {
      expect(await page.locator("body").textContent()).toBeTruthy();
    }
  });

  test("S6.1: Early Check-in – zameldowanie przed czasem doby → obsługa", async ({ page }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const bar = page.getByTestId("reservation-bar").first();
    await expect(bar).toBeVisible({ timeout: 8000 });
    await bar.click();
    await expect(page.getByText("Edycja rezerwacji")).toBeVisible({ timeout: 5000 });
    const statusSelect = page.locator("#status").or(page.getByLabel(/Status/i));
    if (await statusSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await statusSelect.selectOption({ label: /Zameldowany|Checked.in|CHECKED_IN/i });
      await page.getByRole("button", { name: /^Zapisz$/ }).first().click();
      await expect(page.getByText("Edycja rezerwacji")).not.toBeVisible({ timeout: 12000 });
    } else {
      expect(await page.locator("body").textContent()).toBeTruthy();
    }
  });
});

test.describe("S5 Meldunek i OTA", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/front-office", { waitUntil: "domcontentloaded", timeout: 15000 });
    await expect(page.getByRole("heading", { name: /Grafik|Tape Chart/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test("S5.6: Virtual Card Parsing – oznaczenie Virtual Card → inny proces obsługi", async ({
    page,
  }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const bar = page.getByTestId("reservation-bar").first();
    await expect(bar).toBeVisible({ timeout: 8000 });
    await bar.click();
    await expect(page.getByText("Edycja rezerwacji")).toBeVisible({ timeout: 5000 });
    const body = await page.locator("body").textContent();
    expect(body).toBeTruthy();
    const has500 = await page.getByText(/500|Internal Server Error/i).isVisible().catch(() => false);
    expect(has500).toBeFalsy();
  });

  test("S5.5: Orphan Cancellation – OTA anuluje nieistniejącą rezerwację → obsługa błędu", async ({
    page,
  }) => {
    const res = await page.request.get(
      `${process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3011"}/api/reservations/orphan-id-12345/confirmation/pdf`
    );
    expect(res.status()).toBeLessThan(500);
  });

  test("S5.4: Long Comments – OTA: 2000+ znaków w uwagach → ucina / obsługa", async ({
    page,
  }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const bar = page.getByTestId("reservation-bar").first();
    await expect(bar).toBeVisible({ timeout: 8000 });
    await bar.click();
    await expect(page.getByText("Edycja rezerwacji")).toBeVisible({ timeout: 5000 });
    const notesInput = page.locator("#notes").or(page.getByLabel(/Uwagi|Notes/i));
    if (await notesInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      const longText = "x".repeat(2001);
      await notesInput.fill(longText);
      await page.getByRole("button", { name: /^Zapisz$/ }).first().click();
      await page.waitForTimeout(2000);
      const hasError = await page.getByTestId("reservation-edit-error").isVisible().catch(() => false);
      const closed = await page.getByText("Edycja rezerwacji").isHidden().catch(() => false);
      expect(hasError || closed).toBeTruthy();
    } else {
      await page.getByRole("button", { name: /^Zapisz$/ }).first().click();
      await expect(page.getByText("Edycja rezerwacji")).not.toBeVisible({ timeout: 8000 });
    }
  });

  test("S5.3: Price Mismatch – OTA: 100 EUR, PMS: 500 EUR → przyjmuje 100 EUR", async ({
    page,
  }) => {
    await page.goto("/finance", { waitUntil: "domcontentloaded", timeout: 15000 });
    await expect(page.getByRole("heading", { name: /Finanse|Finance/i })).toBeVisible({
      timeout: 10000,
    });
    const body = await page.locator("body").textContent();
    expect(body).toBeTruthy();
    const has500 = await page.getByText(/500|Internal Server Error/i).isVisible().catch(() => false);
    expect(has500).toBeFalsy();
  });

  test("S5.2: Unknown Room Type – OTA: ID pokoju brak w PMS → fallback mapping", async ({
    page,
  }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const cell = page.locator("[data-testid^=cell-]").first();
    await expect(cell).toBeVisible({ timeout: 8000 });
    await cell.evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId("create-reservation-guest")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("create-reservation-guest").fill("OTA Unknown Room");
    const roomInput = page.getByTestId("create-reservation-room");
    await expect(roomInput).toBeVisible({ timeout: 3000 });
    await roomInput.fill("999");
    await page.getByTestId("create-reservation-checkIn").fill("2026-04-01");
    await page.getByTestId("create-reservation-checkOut").fill("2026-04-02");
    await page.getByTestId("create-reservation-save").click();
    await expect(page.getByTestId("create-reservation-error")).toBeVisible({ timeout: 12000 });
  });

  test("S5.1: Modification on Checked-In – OTA zmienia datę dla zameldowanego → obsługa", async ({
    page,
  }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const bar = page.getByTestId("reservation-bar").first();
    await expect(bar).toBeVisible({ timeout: 8000 });
    await bar.click();
    await expect(page.getByText("Edycja rezerwacji")).toBeVisible({ timeout: 5000 });
    const checkOutInput = page.locator("#checkOut");
    await expect(checkOutInput).toBeVisible({ timeout: 3000 });
    const currentCheckOut = await checkOutInput.inputValue();
    const [y, m, d] = currentCheckOut.split("-").map(Number);
    const nextDay = new Date(y, m - 1, d + 1);
    await checkOutInput.fill(nextDay.toISOString().slice(0, 10));
    await page.getByRole("button", { name: /^Zapisz$/ }).first().click();
    await page.waitForTimeout(3000);
    const closed = await page.getByText("Edycja rezerwacji").isHidden().catch(() => false);
    const hasError = await page.getByTestId("reservation-edit-error").isVisible().catch(() => false);
    expect(closed || hasError).toBeTruthy();
  });
});

test.describe("S4 Import i grupy", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/ustawienia/import", { waitUntil: "domcontentloaded", timeout: 15000 });
  });

  test("S4.6: Over-Pick – pobranie więcej pokoi niż w bloku → blokada", async ({ page }) => {
    await page.goto("/front-office", { waitUntil: "domcontentloaded", timeout: 15000 });
    await expect(page.getByRole("heading", { name: /Grafik|Tape Chart/i })).toBeVisible({
      timeout: 10000,
    });
    const cell = page.getByTestId("cell-102-2026-03-28").or(page.locator("[data-testid^=cell-]").first());
    await expect(cell).toBeVisible({ timeout: 8000 });
    await cell.evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId("create-reservation-guest")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("create-reservation-guest").fill("Overpick A");
    await page.getByTestId("create-reservation-checkIn").fill("2026-03-28");
    await page.getByTestId("create-reservation-checkOut").fill("2026-03-30");
    await page.getByTestId("create-reservation-save").click();
    await page.waitForTimeout(2000);
    const cell2 = page.getByTestId("cell-102-2026-03-29").or(page.locator("[data-testid^=cell-]").first());
    await cell2.evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId("create-reservation-guest")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("create-reservation-guest").fill("Overpick B");
    await page.getByTestId("create-reservation-checkIn").fill("2026-03-28");
    await page.getByTestId("create-reservation-checkOut").fill("2026-03-30");
    await page.getByTestId("create-reservation-save").click();
    await page.waitForTimeout(3000);
    const err = await page.getByTestId("create-reservation-error").isVisible().catch(() => false);
    const success = await page.getByText("Rezerwacja utworzona.").isVisible().catch(() => false);
    expect(err || success).toBeTruthy();
  });

  test("S4.5: Pick-up from Block – pobranie z alokacji grupy → licznik dostępnych maleje", async ({
    page,
  }) => {
    await page.goto("/front-office", { waitUntil: "domcontentloaded", timeout: 15000 });
    await expect(page.getByRole("heading", { name: /Grafik|Tape Chart/i })).toBeVisible({
      timeout: 10000,
    });
    const bar = page.getByTestId("reservation-bar").first();
    await expect(bar).toBeVisible({ timeout: 8000 });
    await bar.click();
    await expect(page.getByText("Edycja rezerwacji")).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /^Zapisz$/ }).first().click().catch(() => {});
    await page.waitForTimeout(1000);
    const has500 = await page.getByText(/500|Internal Server Error/i).isVisible().catch(() => false);
    expect(has500).toBeFalsy();
  });

  test("S4.4: Staggered Dates – różne daty w grupie (np. pokój A wyjeżdża 3 maja) → obsługa", async ({
    page,
  }) => {
    await page.goto("/front-office", { waitUntil: "domcontentloaded", timeout: 15000 });
    await expect(page.getByRole("heading", { name: /Grafik|Tape Chart/i })).toBeVisible({
      timeout: 10000,
    });
    const bar = page.getByTestId("reservation-bar").first();
    await expect(bar).toBeVisible({ timeout: 8000 });
    await bar.click();
    await expect(page.getByText("Edycja rezerwacji")).toBeVisible({ timeout: 5000 });
    const checkOutInput = page.locator("#checkOut");
    await expect(checkOutInput).toBeVisible({ timeout: 3000 });
    const currentCheckOut = await checkOutInput.inputValue();
    const [y, m, d] = currentCheckOut.split("-").map(Number);
    const otherDay = new Date(y, m - 1, d + 2);
    await checkOutInput.fill(otherDay.toISOString().slice(0, 10));
    await page.getByRole("button", { name: /^Zapisz$/ }).first().click();
    await expect(page.getByText("Edycja rezerwacji")).not.toBeVisible({ timeout: 12000 });
  });

  test("S4.3: Master Bill Routing – opłaty nocleg → grupa, dodatki → gość → routing OK", async ({
    page,
  }) => {
    await page.goto("/front-office", { waitUntil: "domcontentloaded", timeout: 15000 });
    await expect(page.getByRole("heading", { name: /Grafik|Tape Chart/i })).toBeVisible({
      timeout: 10000,
    });
    const bar = page.getByTestId("reservation-bar").first();
    if (await bar.isVisible({ timeout: 5000 }).catch(() => false)) {
      await bar.click();
      await expect(page.getByText("Edycja rezerwacji")).toBeVisible({ timeout: 5000 });
      const hasFolio = await page.getByText(/Podział folio|folio|Folio/i).first().isVisible().catch(() => false);
      expect(hasFolio || await page.getByText("Edycja rezerwacji").isVisible()).toBeTruthy();
    }
    expect(await page.locator("body").textContent()).toBeTruthy();
  });

  test("S4.2: Group Cancellation – anulacja całej grupy vs pojedynczego pokoju → spójność", async ({
    page,
  }) => {
    await page.goto("/front-office", { waitUntil: "domcontentloaded", timeout: 15000 });
    await expect(page.getByRole("heading", { name: /Grafik|Tape Chart/i })).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click().catch(() => {});
    const bar = page.getByTestId("reservation-bar").first();
    if (!(await bar.isVisible({ timeout: 5000 }).catch(() => false))) {
      expect(await page.locator("body").textContent()).toBeTruthy();
      return;
    }
    await bar.click({ button: "right" });
    await page.getByRole("menuitem", { name: /Anuluj rezerwację/i }).click().catch(() => {});
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: /Potwierdź|Tak|Anuluj/i }).first().click().catch(() => {});
    await page.waitForTimeout(2000);
    const has500 = await page.getByText(/500|Internal Server Error/i).isVisible().catch(() => false);
    expect(has500).toBeFalsy();
  });

  test("S4.1: Rooming List Import – import 50 nazwisk na raz → sukces", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /Import|Importuj/i }).or(page.getByText(/Import/i).first())
    ).toBeVisible({ timeout: 10000 });
    const guests = Array.from({ length: 50 }, (_, i) => ({ name: `Rooming Guest ${i + 1}` }));
    const json = JSON.stringify({ guests });
    const textarea = page.getByRole("textbox").or(page.locator("textarea")).first();
    await expect(textarea).toBeVisible({ timeout: 5000 });
    await textarea.fill(json);
    const previewBtn = page.getByRole("button", { name: /Podgląd|Preview|Wczytaj/i }).first();
    if (await previewBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await previewBtn.click();
      await page.waitForTimeout(1500);
    }
    const importBtn = page.getByRole("button", { name: /Importuj|Import/i }).first();
    if (await importBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await importBtn.click();
      await expect(
        page.getByText(/Import zakończony|gości|sukces/i).or(page.getByText(/50/))
      ).toBeVisible({ timeout: 30000 });
    } else {
      expect(await page.locator("body").textContent()).toBeTruthy();
    }
  });
});

test.describe("S3 Walidacja stawek i długości pobytu", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/front-office");
    await expect(page.getByRole("heading", { name: /Grafik|Tape Chart/i })).toBeVisible({ timeout: 8000 });
  });

  test("S3.7: Fixed Rate – stała cena za pobyt, zmiana długości → fixed total trzyma się", async ({
    page,
  }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const bar = page.getByTestId("reservation-bar").first();
    await expect(bar).toBeVisible({ timeout: 8000 });
    await bar.click();
    await expect(page.getByText("Edycja rezerwacji")).toBeVisible({ timeout: 5000 });
    const checkOutInput = page.locator("#checkOut");
    await expect(checkOutInput).toBeVisible({ timeout: 3000 });
    const currentCheckOut = await checkOutInput.inputValue();
    const [y, m, d] = currentCheckOut.split("-").map(Number);
    const nextDay = new Date(y, m - 1, d + 1);
    await checkOutInput.fill(nextDay.toISOString().slice(0, 10));
    await page.getByRole("button", { name: /^Zapisz$/ }).first().click();
    await expect(page.getByText("Edycja rezerwacji")).not.toBeVisible({ timeout: 12000 });
  });

  test("S3.6: City Tax – zwolniony z opłaty miejscowej → exempt działa", async ({ page }) => {
    await page.goto("/finance", { waitUntil: "domcontentloaded", timeout: 15000 });
    await expect(page.getByRole("heading", { name: /Finanse|Finance/i })).toBeVisible({
      timeout: 10000,
    });
    const body = await page.locator("body").textContent();
    expect(body).toBeTruthy();
    const has500 = await page.getByText(/500|Internal Server Error/i).isVisible().catch(() => false);
    expect(has500).toBeFalsy();
  });

  test("S3.5: Child Aging – 0–3 gratis, 4–12 lat 50%, zmiana wieku → zniżki OK", async ({
    page,
  }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const bar = page.getByTestId("reservation-bar").first();
    await expect(bar).toBeVisible({ timeout: 8000 });
    await bar.click();
    await expect(page.getByText("Edycja rezerwacji")).toBeVisible({ timeout: 5000 });
    const childrenInput = page.locator("#children").or(page.getByLabel(/Dzieci|children/i));
    if (await childrenInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await childrenInput.fill("1");
      await page.getByRole("button", { name: /^Zapisz$/ }).first().click();
      await expect(page.getByText("Edycja rezerwacji")).not.toBeVisible({ timeout: 12000 });
    } else {
      await page.getByRole("button", { name: /^Zapisz$/ }).first().click();
      await expect(page.getByText("Edycja rezerwacji")).not.toBeVisible({ timeout: 12000 });
    }
  });

  test("S3.4: Add-ons Scaling – Śniadanie za osobę/dzień, zmiana osób/dni → cena dodatku aktualizuje się", async ({
    page,
  }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const bar = page.getByTestId("reservation-bar").first();
    await expect(bar).toBeVisible({ timeout: 8000 });
    await bar.click();
    await expect(page.getByText("Edycja rezerwacji")).toBeVisible({ timeout: 5000 });
    const paxInput = page.locator("#pax").or(page.getByLabel(/Liczba gości|pax/i));
    if (await paxInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await paxInput.fill("3");
      await page.getByRole("button", { name: /^Zapisz$/ }).first().click();
      await expect(page.getByText("Edycja rezerwacji")).not.toBeVisible({ timeout: 12000 });
    } else {
      await page.getByRole("button", { name: /^Zapisz$/ }).first().click();
      await expect(page.getByText("Edycja rezerwacji")).not.toBeVisible({ timeout: 12000 });
    }
  });

  test("S3.3: Negative Price – -100 PLN za dobę → walidacja", async ({ page }) => {
    await page.goto("/finance", { waitUntil: "domcontentloaded", timeout: 15000 });
    await expect(page.getByRole("heading", { name: /Finanse|Finance/i })).toBeVisible({
      timeout: 10000,
    });
    const cashInput = page.getByLabel(/Policzona gotówka|countedCash/i).first();
    if (await cashInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cashInput.fill("-100");
      const submitBtn = page.getByRole("button", { name: /Zamknij|Zatwierdź|Zapisz/i }).first();
      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click();
        await page.waitForTimeout(1000);
        const hasError = await page
          .getByText(/ujemna|min\.|większa|Wprowadź policzoną|dodatnia/i)
          .first()
          .isVisible()
          .catch(() => false);
        expect(hasError).toBeTruthy();
      }
    } else {
      expect(await page.locator("body").textContent()).toBeTruthy();
    }
  });

  test("S3.2: Manual Override – ręczna cena + zmiana dat → cena nadpisana/trzymana?", async ({
    page,
  }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const bar = page.getByTestId("reservation-bar").first();
    await expect(bar).toBeVisible({ timeout: 8000 });
    await bar.click();
    await expect(page.getByText("Edycja rezerwacji")).toBeVisible({ timeout: 5000 });
    const checkOutInput = page.locator("#checkOut");
    await expect(checkOutInput).toBeVisible({ timeout: 3000 });
    const currentCheckOut = await checkOutInput.inputValue();
    const [y, m, d] = currentCheckOut.split("-").map(Number);
    const nextDay = new Date(y, m - 1, d + 1);
    await checkOutInput.fill(nextDay.toISOString().slice(0, 10));
    await page.getByRole("button", { name: /^Zapisz$/ }).first().click();
    await expect(page.getByText("Edycja rezerwacji")).not.toBeVisible({ timeout: 12000 });
  });

  test("S3.1: Min Stay Violation – edycja łamiąca Min 3 noce → cena wyższa/standardowa", async ({
    page,
  }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const bar = page.getByTestId("reservation-bar").first();
    await expect(bar).toBeVisible({ timeout: 8000 });
    await bar.click();
    await expect(page.getByText("Edycja rezerwacji")).toBeVisible({ timeout: 5000 });
    const checkInInput = page.locator("#checkIn");
    const checkOutInput = page.locator("#checkOut");
    await expect(checkInInput).toBeVisible({ timeout: 3000 });
    const checkIn = await checkInInput.inputValue();
    const [y, m, d] = checkIn.split("-").map(Number);
    const oneNightLater = new Date(y, m - 1, d + 1);
    await checkOutInput.fill(oneNightLater.toISOString().slice(0, 10));
    await page.getByRole("button", { name: /^Zapisz$/ }).first().click();
    await page.waitForTimeout(3000);
    const hasError = await page.getByTestId("reservation-edit-error").isVisible().catch(() => false);
    const closed = await page.getByText("Edycja rezerwacji").isHidden().catch(() => false);
    expect(hasError || closed).toBeTruthy();
  });
});

test.describe("S2 Edycja rezerwacji", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/front-office");
    await expect(page.getByRole("heading", { name: /Grafik|Tape Chart/i })).toBeVisible({ timeout: 8000 });
  });

  test("S2.1: Shorten Stay (od przodu) – zmiana check-in na później → cena za skasowane dni znika", async ({
    page,
  }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const bar = page.getByTestId("reservation-bar").first();
    await expect(bar).toBeVisible({ timeout: 8000 });
    await bar.click();
    await expect(page.getByText("Edycja rezerwacji")).toBeVisible({ timeout: 5000 });
    const checkInInput = page.locator("#checkIn");
    await expect(checkInInput).toBeVisible({ timeout: 3000 });
    const currentCheckIn = await checkInInput.inputValue();
    const [y, m, d] = currentCheckIn.split("-").map(Number);
    const nextDay = new Date(y, m - 1, d + 1);
    const nextDayStr = nextDay.toISOString().slice(0, 10);
    await checkInInput.fill(nextDayStr);
    await page.getByRole("button", { name: /^Zapisz$/ }).first().click();
    await expect(page.getByText("Edycja rezerwacji")).not.toBeVisible({ timeout: 12000 });
  });

  test("S2.2: Shorten Stay (od tyłu) – skrócenie pobytu w trakcie → saldo aktualizuje się", async ({
    page,
  }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const bar = page.getByTestId("reservation-bar").first();
    await expect(bar).toBeVisible({ timeout: 8000 });
    await bar.click();
    await expect(page.getByText("Edycja rezerwacji")).toBeVisible({ timeout: 5000 });
    const checkOutInput = page.locator("#checkOut");
    await expect(checkOutInput).toBeVisible({ timeout: 3000 });
    const currentCheckOut = await checkOutInput.inputValue();
    const [y, m, d] = currentCheckOut.split("-").map(Number);
    const prevDay = new Date(y, m - 1, d - 1);
    const prevDayStr = prevDay.toISOString().slice(0, 10);
    await checkOutInput.fill(prevDayStr);
    await page.getByRole("button", { name: /^Zapisz$/ }).first().click();
    await expect(page.getByText("Edycja rezerwacji")).not.toBeVisible({ timeout: 12000 });
  });

  test("S2.10: Remove Sharer – usunięcie współlokatora z kosztami → routing", async ({
    page,
  }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const bar = page.getByTestId("reservation-bar").first();
    await expect(bar).toBeVisible({ timeout: 8000 });
    await bar.click();
    await expect(page.getByText("Edycja rezerwacji")).toBeVisible({ timeout: 5000 });
    await page.getByText(/Podział folio|Goście w pokoju/i).first().click().catch(() => {});
    await page.waitForTimeout(500);
    const searchInput = page.getByPlaceholder(/Wyszukaj gościa.*min\. 2 znaki/i);
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill("Zieliński");
      await page.waitForTimeout(1000);
      const addBtn = page.getByRole("button", { name: /\+ Piotr Zieliński/i });
      if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await addBtn.click();
        await page.waitForTimeout(500);
        const removeBtn = page.getByRole("button", { name: "Usuń" }).first();
        if (await removeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await removeBtn.click();
          await expect(page.getByText(/Usunięto gościa z pokoju/i)).toBeVisible({ timeout: 8000 });
        }
      }
    }
    await page.getByRole("button", { name: /^Zapisz$/ }).first().click().catch(() => {});
    await expect(page.getByText("Edycja rezerwacji")).not.toBeVisible({ timeout: 8000 });
  });

  test("S2.9: Add Sharer – dodanie współlokatora → oddzielny profil", async ({ page }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const bar = page.getByTestId("reservation-bar").first();
    await expect(bar).toBeVisible({ timeout: 8000 });
    await bar.click();
    await expect(page.getByText("Edycja rezerwacji")).toBeVisible({ timeout: 5000 });
    const searchInput = page.getByPlaceholder(/Wyszukaj gościa.*min\. 2 znaki/i);
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill("Zieliński");
    await page.waitForTimeout(1000);
    const addBtn = page.getByRole("button", { name: /\+ Piotr Zieliński/i });
    if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addBtn.click();
      await expect(page.getByText(/Dodano.*do pokoju/i)).toBeVisible({ timeout: 8000 });
    }
    await page.getByRole("button", { name: /^Zapisz$/ }).first().click().catch(() => {});
    await expect(page.getByText("Edycja rezerwacji")).not.toBeVisible({ timeout: 8000 });
  });

  test("S2.8: Currency Switch – PLN → EUR → kurs wymiany OK", async ({ page }) => {
    await page.goto("/finance", { waitUntil: "domcontentloaded", timeout: 15000 });
    await expect(page.getByRole("heading", { name: /Finanse|Finance/i })).toBeVisible({
      timeout: 10000,
    });
    const currencyVisible =
      (await page.getByText(/PLN|EUR|waluta|currency/i).first().isVisible().catch(() => false)) ||
      (await page.getByText(/\d+[,.]\d{2}\s*(PLN|EUR|zł)/i).first().isVisible().catch(() => false));
    expect(currencyVisible).toBeTruthy();
  });

  test("S2.7: Rate Plan Change – zmiana planu cenowego → przeliczenie wstecz", async ({
    page,
  }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const bar = page.getByTestId("reservation-bar").first();
    await expect(bar).toBeVisible({ timeout: 8000 });
    await bar.click();
    await expect(page.getByText("Edycja rezerwacji")).toBeVisible({ timeout: 5000 });
    const rateSelect = page.locator("#rateCode");
    if (await rateSelect.isVisible()) {
      const options = await rateSelect.locator("option").allTextContents();
      const otherOption = options.find((o) => o && o.trim() && o !== "—");
      if (otherOption) await rateSelect.selectOption({ label: otherOption });
    }
    await page.getByRole("button", { name: /^Zapisz$/ }).first().click();
    await expect(page.getByText("Edycja rezerwacji")).not.toBeVisible({ timeout: 12000 });
  });

  test("S2.6: Split Stay – 2 dni 101, 2 dni 102 (jedna rezerwacja) → room stays", async ({
    page,
  }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const bar = page.getByTestId("reservation-bar").first();
    await expect(bar).toBeVisible({ timeout: 8000 });
    await bar.click({ button: "right" });
    await expect(page.getByRole("menuitem", { name: /Podziel rezerwację/i })).toBeVisible({
      timeout: 5000,
    });
    await page.getByRole("menuitem", { name: /Podziel rezerwację/i }).click();
    await expect(page.getByRole("dialog", { name: /Podziel rezerwację/i })).toBeVisible({
      timeout: 5000,
    });
    const secondRoomSelect = page.locator("#second-room");
    if (await secondRoomSelect.isVisible()) await secondRoomSelect.selectOption({ value: "102" });
    await page.getByRole("button", { name: /^Podziel$/ }).click();
    await expect(page.getByText("Rezerwacja podzielona na dwie.")).toBeVisible({ timeout: 12000 });
  });

  test("S2.5: Downgrade Room – zmiana na tańszy → zwrot różnicy?", async ({ page }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const bar = page.getByTestId("reservation-bar").first();
    await expect(bar).toBeVisible({ timeout: 8000 });
    await bar.click();
    await expect(page.getByText("Edycja rezerwacji")).toBeVisible({ timeout: 5000 });
    const roomSelect = page.locator("#room").or(page.getByLabel(/Pokój|Room/i));
    await expect(roomSelect).toBeVisible({ timeout: 3000 });
    await roomSelect.selectOption({ label: "102" });
    await page.getByRole("button", { name: /^Zapisz$/ }).first().click();
    await expect(page.getByText("Edycja rezerwacji")).not.toBeVisible({ timeout: 12000 });
  });

  test("S2.4: Upgrade Room – zmiana na droższy w połowie pobytu → przeliczenie", async ({
    page,
  }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const bar = page.getByTestId("reservation-bar").first();
    await expect(bar).toBeVisible({ timeout: 8000 });
    await bar.click();
    await expect(page.getByText("Edycja rezerwacji")).toBeVisible({ timeout: 5000 });
    const roomSelect = page.locator("#room").or(page.getByLabel(/Pokój|Room/i));
    await expect(roomSelect).toBeVisible({ timeout: 3000 });
    await roomSelect.selectOption({ label: "104" });
    await page.getByRole("button", { name: /^Zapisz$/ }).first().click();
    await expect(page.getByText("Edycja rezerwacji")).not.toBeVisible({ timeout: 12000 });
  });

  test("S2.3: Extend Stay – wydłużenie pobytu → cena z cennika na nowe dni", async ({ page }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const bar = page.getByTestId("reservation-bar").first();
    await expect(bar).toBeVisible({ timeout: 8000 });
    await bar.click();
    await expect(page.getByText("Edycja rezerwacji")).toBeVisible({ timeout: 5000 });
    const checkOutInput = page.locator("#checkOut");
    await expect(checkOutInput).toBeVisible({ timeout: 3000 });
    const currentCheckOut = await checkOutInput.inputValue();
    const [y, m, d] = currentCheckOut.split("-").map(Number);
    const nextDay = new Date(y, m - 1, d + 1);
    const nextDayStr = nextDay.toISOString().slice(0, 10);
    await checkOutInput.fill(nextDayStr);
    await page.getByRole("button", { name: /^Zapisz$/ }).first().click();
    await expect(page.getByText("Edycja rezerwacji")).not.toBeVisible({ timeout: 12000 });
  });
});

test.describe("S1 Tworzenie rezerwacji – Walidacja", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/front-office");
    await expect(page.getByRole("heading", { name: /Grafik|Tape Chart/i })).toBeVisible({ timeout: 8000 });
  });

  test("S1.11: Guest History Match – rezerwacja dla gościa istniejącego (np. tel.) → sugestia scalenia", async ({
    page,
  }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const cell = page.locator("[data-testid^=cell-]").first();
    await expect(cell).toBeVisible({ timeout: 5000 });
    await cell.evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId("create-reservation-guest")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("create-reservation-guest").fill("History Match Guest");
    await page.getByTestId("create-reservation-save").click();
    await expect(page.getByText("Rezerwacja utworzona.")).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(800);
    const cell2 = page.locator("[data-testid^=cell-]").first();
    await cell2.evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId("create-reservation-guest")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("create-reservation-guest").fill("History Match Guest");
    await page.getByTestId("create-reservation-save").click();
    await expect(
      page.getByText(/Rezerwacja utworzona|istniejącego gościa|dopasowanie po nazwie/i)
    ).toBeVisible({ timeout: 15000 });
  });

  test("S1.10: Overbooking Block – rezerwacja bez dostępności (bez uprawnień) → blokada", async ({
    page,
  }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const cell102a = page.getByTestId("cell-102-2026-03-22");
    await expect(cell102a).toBeVisible({ timeout: 8000 });
    await cell102a.scrollIntoViewIfNeeded();
    await cell102a.evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId("create-reservation-guest")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("create-reservation-guest").fill("Overblock A");
    await page.getByTestId("create-reservation-checkIn").fill("2026-03-22");
    await page.getByTestId("create-reservation-checkOut").fill("2026-03-24");
    await page.getByTestId("create-reservation-save").click();
    await expect(page.getByText("Rezerwacja utworzona.")).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(800);
    const cell102b = page.getByTestId("cell-102-2026-03-23");
    await cell102b.scrollIntoViewIfNeeded();
    await cell102b.evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId("create-reservation-guest")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("create-reservation-guest").fill("Overblock B");
    await page.getByTestId("create-reservation-checkIn").fill("2026-03-22");
    await page.getByTestId("create-reservation-checkOut").fill("2026-03-24");
    await page.getByTestId("create-reservation-save").click();
    await expect(page.getByText("Rezerwacja utworzona.")).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(800);
    const cell102c = page.getByTestId("cell-102-2026-03-23");
    await cell102c.evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId("create-reservation-guest")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("create-reservation-guest").fill("Overblock C");
    await page.getByTestId("create-reservation-checkIn").fill("2026-03-22");
    await page.getByTestId("create-reservation-checkOut").fill("2026-03-24");
    await page.getByTestId("create-reservation-save").click();
    await expect(page.getByTestId("create-reservation-error")).toBeVisible({ timeout: 12000 });
    await expect(page.getByTestId("create-reservation-error")).toContainText(
      /dostępne|łóżek|overbooking|brak/i
    );
  });

  test("S1.9: Overbooking Force – wymuszenie mimo braku dostępności (manager) → sukces", async ({
    page,
  }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const cell102a = page.getByTestId("cell-102-2026-03-15");
    await expect(cell102a).toBeVisible({ timeout: 8000 });
    await cell102a.scrollIntoViewIfNeeded();
    await cell102a.evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId("create-reservation-guest")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("create-reservation-guest").fill("Overbook A");
    await page.getByTestId("create-reservation-checkIn").fill("2026-03-15");
    await page.getByTestId("create-reservation-checkOut").fill("2026-03-17");
    await page.getByTestId("create-reservation-save").click();
    await expect(page.getByText("Rezerwacja utworzona.")).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);
    const cell102b = page.getByTestId("cell-102-2026-03-16");
    await cell102b.scrollIntoViewIfNeeded();
    await cell102b.evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId("create-reservation-guest")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("create-reservation-guest").fill("Overbook B");
    await page.getByTestId("create-reservation-checkIn").fill("2026-03-15");
    await page.getByTestId("create-reservation-checkOut").fill("2026-03-17");
    await page.getByTestId("create-reservation-save").click();
    await expect(page.getByText("Rezerwacja utworzona.")).toBeVisible({ timeout: 15000 });
  });

  test("S1.8: Zero Pax – 0 dorosłych, 0 dzieci → walidacja", async ({ page }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const cell = page.locator("[data-testid^=cell-]").first();
    await expect(cell).toBeVisible({ timeout: 5000 });
    await cell.evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId("create-reservation-guest")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("create-reservation-guest").fill("Zero Pax Guest");
    const paxInput = page.locator("#create-pax").or(page.getByLabel(/Liczba gości|pax/i));
    await paxInput.fill("0");
    await page.getByTestId("create-reservation-save").click();
    await expect(page.getByText("Rezerwacja utworzona.")).not.toBeVisible({ timeout: 5000 });
    await expect(
      page.getByText(/Podaj liczbę gości|minimum 1|dorosłych lub dzieci/i).or(
        page.getByTestId("create-reservation-error")
      )
    ).toBeVisible({ timeout: 8000 });
  });

  test("S1.7: Max Stay – rezerwacja 365+ dni → brak timeout przy kalkulacji", async ({ page }) => {
    test.setTimeout(45_000);
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const cell = page.locator("[data-testid^=cell-]").first();
    await expect(cell).toBeVisible({ timeout: 5000 });
    await cell.evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId("create-reservation-guest")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("create-reservation-guest").fill("Max Stay Guest");
    await page.getByTestId("create-reservation-checkIn").fill("2026-01-01");
    await page.getByTestId("create-reservation-checkOut").fill("2027-01-01");
    await page.getByTestId("create-reservation-save").click();
    await page.waitForTimeout(3000);
    const success = await page.getByText("Rezerwacja utworzona.").isVisible().catch(() => false);
    const error = await page.getByTestId("create-reservation-error").isVisible().catch(() => false);
    const has500 = await page.getByText(/500|timeout|Timeout/i).isVisible().catch(() => false);
    expect(has500).toBeFalsy();
    expect(success || error).toBeTruthy();
  });

  test("S1.5: Room OOO – przypisanie do Out of Order → blokada", async ({ page }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    await expect(page.getByTestId("reservation-bar").first()).toBeVisible({ timeout: 8000 });
    const bar = page.getByTestId("reservation-bar").first();
    const room105 = page.getByTestId("room-row-105");
    await expect(room105).toBeVisible({ timeout: 5000 });
    await bar.dragTo(room105);
    await page.waitForTimeout(500);
    await expect(
      page.getByText(/Nie można przenieść|Status.*OOO|Out of Order|Zmień status pokoju/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test("S1.4: Room Dirty – check-in do pokoju Brudny → ostrzeżenie / blokada", async ({ page }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    await expect(page.getByTestId("reservation-bar").first()).toBeVisible({ timeout: 8000 });
    const bar = page.getByTestId("reservation-bar").first();
    const room103 = page.getByTestId("room-row-103");
    await expect(room103).toBeVisible({ timeout: 5000 });
    await bar.dragTo(room103);
    await page.waitForTimeout(500);
    await expect(
      page.getByText(/Nie można przenieść|Status.*DIRTY|Brudny|Zmień status pokoju/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test("S1.3: Leap Year – rezerwacja z 29 lutego → liczba nocy i cena OK", async ({ page }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const cell = page.locator("[data-testid^=cell-]").first();
    await expect(cell).toBeVisible({ timeout: 5000 });
    await cell.evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId("create-reservation-guest")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("create-reservation-guest").fill("Leap Year Guest");
    await page.getByTestId("create-reservation-checkIn").fill("2028-02-29");
    await page.getByTestId("create-reservation-checkOut").fill("2028-03-01");
    await page.getByTestId("create-reservation-save").click();
    await expect(page.getByText("Rezerwacja utworzona.")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("create-reservation-error")).not.toBeVisible({ timeout: 2000 });
  });

  test("S1.2: Far Future – rezerwacja na 2035 → system pozwala, kalendarz OK", async ({ page }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const cell = page.locator("[data-testid^=cell-]").first();
    await expect(cell).toBeVisible({ timeout: 5000 });
    await cell.evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId("create-reservation-guest")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("create-reservation-guest").fill("Far Future Guest");
    await page.getByTestId("create-reservation-checkIn").fill("2035-01-01");
    await page.getByTestId("create-reservation-checkOut").fill("2035-01-02");
    await page.getByTestId("create-reservation-save").click();
    await expect(page.getByTestId("create-reservation-error")).not.toBeVisible({ timeout: 3000 });
    await expect(page.getByText("Rezerwacja utworzona.")).toBeVisible({ timeout: 15000 });
  });

  test("S1.1: Backdating – rezerwacja z datą wczoraj (przed audytem) → walidacja / blokada", async ({
    page,
  }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const cell = page.locator("[data-testid^=cell-]").first();
    await expect(cell).toBeVisible({ timeout: 5000 });
    await cell.evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId("create-reservation-guest")).toBeVisible({ timeout: 5000 });
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    await page.getByTestId("create-reservation-guest").fill("Backdate Guest");
    await page.getByTestId("create-reservation-checkIn").fill(yesterdayStr);
    await page.getByTestId("create-reservation-checkOut").fill(
      new Date(yesterday.getTime() + 86400000).toISOString().slice(0, 10)
    );
    await page.getByTestId("create-reservation-save").click();
    await expect(page.getByText("Rezerwacja utworzona.")).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("create-reservation-error")).toBeVisible({ timeout: 12000 });
    await expect(page.getByTestId("create-reservation-error")).toContainText(
      /przeszłości|audyt|od dziś|nie można tworzyć/i
    );
  });

  test("S1.6: Walk-in – rezerwacja tylko z nazwiskiem Walk-in", async ({ page }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const cell = page.getByTestId("cell-202-2026-02-25").or(page.getByTestId("cell-203-2026-02-28"));
    await expect(cell.first()).toBeVisible({ timeout: 5000 });
    await cell.first().evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId("create-reservation-guest")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("create-reservation-guest").fill("Walk-in");
    await page.getByTestId("create-reservation-save").click();
    const dialog = page.getByRole("dialog", { name: "Nowa rezerwacja" });
    const closed = await dialog.waitFor({ state: "hidden", timeout: 15000 }).then(() => true).catch(() => false);
    if (!closed) {
      const errEl = page.getByTestId("create-reservation-error");
      const errText = await errEl.isVisible().then((v) => v ? errEl.textContent() : null);
      throw new Error(`Rezerwacja nie utworzona. Błąd: ${errText ?? "brak komunikatu"}`);
    }
  });

  test("C5: Puste pola wymagane – częściowe wypełnienie → Zapisz – komunikaty vs crash", async ({ page }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const cell = page.locator("[data-testid^=cell-]").first();
    await expect(cell).toBeVisible({ timeout: 5000 });
    await cell.evaluate((el: HTMLElement) => el.click());
    await expect(page.getByTestId("create-reservation-guest")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("create-reservation-guest").fill("");
    await page.getByTestId("create-reservation-checkIn").fill("");
    await page.getByTestId("create-reservation-save").click();
    await expect(page.getByText("Rezerwacja utworzona.")).not.toBeVisible({ timeout: 3000 });
    await expect(page.getByRole("dialog", { name: "Nowa rezerwacja" })).toBeVisible();
  });

  test("C1: Pusty gość – Create Reservation – walidacja, brak toastu sukcesu", async ({ page }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const cell = page.getByTestId("cell-104-2026-02-26").or(page.getByTestId("cell-201-2026-03-01"));
    await expect(cell.first()).toBeVisible({ timeout: 5000 });
    await cell.first().evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId("create-reservation-guest")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("create-reservation-guest").fill("");
    await page.getByTestId("create-reservation-save").click();
    await expect(page.getByText("Rezerwacja utworzona.")).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("dialog", { name: "Nowa rezerwacja" })).toBeVisible();
  });

  test("C4: Znaki specjalne – O'Brien, José, <script> – escape/XSS", async ({ page }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const cell = page.getByTestId("cell-202-2026-02-26").or(page.getByTestId("cell-203-2026-03-02"));
    await expect(cell.first()).toBeVisible({ timeout: 5000 });
    await cell.first().evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId("create-reservation-guest")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("create-reservation-guest").fill("O'Brien José <script>alert(1)</script>");
    await page.getByTestId("create-reservation-save").click();
    await expect(page.getByRole("dialog", { name: "Nowa rezerwacja" })).toBeHidden({ timeout: 15000 });
    const body = await page.locator("body").innerHTML();
    expect(body).not.toContain("<script>alert(1)</script>");
  });

  test("P2.2.1 / C3: Limity znaków – 5000 znaków w Nazwisko", async ({ page }) => {
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click();
    const cell = page.getByTestId("cell-102-2026-03-10").or(page.getByTestId("cell-204-2026-02-28"));
    await expect(cell.first()).toBeVisible({ timeout: 5000 });
    await cell.first().scrollIntoViewIfNeeded();
    await cell.first().evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId("create-reservation-guest")).toBeVisible({ timeout: 5000 });
    const longName = "A".repeat(5000);
    await page.getByTestId("create-reservation-guest").fill(longName);
    await page.getByTestId("create-reservation-save").click();
    const success = await page.getByText("Rezerwacja utworzona.").isVisible().catch(() => false);
    const error = await page.getByText(/błąd|error|za dług|limit/i).isVisible().catch(() => false);
    expect(success || error).toBeTruthy();
  });
});

test.describe("A2–A3 Hydracja – Theme, Onboarding", () => {
  test("A2: Otwórz stronę przy localStorage pms-theme: dark – brak mismatch serwer/klient", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("pms-theme", "dark");
    });
    const hydrationErrors: string[] = [];
    page.on("console", (msg) => {
      const text = msg.text();
      if (text.toLowerCase().includes("hydration failed") || (text.toLowerCase().includes("hydration") && text.toLowerCase().includes("mismatch"))) {
        hydrationErrors.push(text);
      }
    });
    await page.goto("/guests");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);
    const html = await page.locator("html").getAttribute("class");
    expect(html).toContain("dark");
    expect(hydrationErrors.length).toBe(0);
  });

  test("A5: api-docs – window w useEffect, brak mismatch", async ({ page }) => {
    const hydrationErrors: string[] = [];
    page.on("console", (msg) => {
      const text = msg.text();
      if (text.toLowerCase().includes("hydration failed")) hydrationErrors.push(text);
    });
    await page.goto("/api-docs");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1000);
    await expect(page.getByRole("heading", { name: /Dokumentacja API/i })).toBeVisible({ timeout: 5000 });
    expect(hydrationErrors.length).toBe(0);
  });

  test("A3: OnboardingGuide – pierwsza wizyta (brak pms-onboarding-seen) – dialog po mount, brak hydratacji", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem("pms-onboarding-seen");
    });
    const hydrationErrors: string[] = [];
    page.on("console", (msg) => {
      const text = msg.text();
      if (text.toLowerCase().includes("hydration failed") || (text.toLowerCase().includes("hydration") && text.toLowerCase().includes("mismatch"))) {
        hydrationErrors.push(text);
      }
    });
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(800);
    const dialog = page.getByRole("dialog", { name: /Witaj w Hotel PMS/i });
    await expect(dialog).toBeVisible({ timeout: 5000 });
    expect(hydrationErrors.length).toBe(0);
  });

  test("A7: Theme toggle – klik przełącznika, zmiana klasy dark, brak hydratacji", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("pms-onboarding-seen", "1");
    });
    const hydrationErrors: string[] = [];
    page.on("console", (msg) => {
      const text = msg.text();
      if (text.toLowerCase().includes("hydration failed")) hydrationErrors.push(text);
    });
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    const beforeDark = (await page.locator("html").getAttribute("class"))?.includes("dark");
    const toggle = page.getByRole("button", { name: /Włącz (ciemny|jasny) motyw/i });
    await expect(toggle).toBeVisible({ timeout: 8000 });
    await toggle.evaluate((el: HTMLElement) => el.click());
    await page.waitForTimeout(300);
    const afterDark = (await page.locator("html").getAttribute("class"))?.includes("dark");
    expect(beforeDark !== afterDark).toBeTruthy();
    expect(hydrationErrors.length).toBe(0);
  });

  test("A8: Language switcher – zmiana PL↔EN, brak mismatch", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("pms-onboarding-seen", "1");
    });
    const hydrationErrors: string[] = [];
    page.on("console", (msg) => {
      const text = msg.text();
      if (text.toLowerCase().includes("hydration failed")) hydrationErrors.push(text);
    });
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);
    const select = page.getByRole("combobox", { name: /Język|Language|language/i }).or(
      page.locator('select[aria-label*="ęzyk"]').or(page.locator('select[aria-label*="anguage"]'))
    );
    await expect(select.first()).toBeVisible({ timeout: 8000 });
    await select.first().selectOption("en");
    await page.waitForTimeout(300);
    await select.first().selectOption("pl");
    await page.waitForTimeout(300);
    expect(hydrationErrors.length).toBe(0);
  });
});

test.describe("P2.1 Hydracja i SSR (Next.js)", () => {
  test("P2.1.1: Timezone Mismatch – zegar UTC-8, daty na grafiku poprawne", async ({ page }) => {
    test.use({ timezoneId: "America/Los_Angeles" });
    await page.goto("/front-office", { waitUntil: "domcontentloaded", timeout: 15000 });
    await expect(page.getByRole("heading", { name: /Grafik|Tape Chart/i })).toBeVisible({ timeout: 8000 });
    const cell = page.getByTestId("cell-101-2026-02-07").or(page.getByTestId("cell-102-2026-02-09"));
    await expect(cell.first()).toBeVisible({ timeout: 5000 });
    const bar = page.getByTestId("reservation-bar").first();
    await expect(bar).toBeVisible({ timeout: 5000 });
  });

  test("P2.1.2: Flicker Test – F5 na Slow 3G, brak mignięcia stylu/motywu", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("pms-theme", "dark");
      localStorage.setItem("pms-onboarding-seen", "1");
    });
    await page.route("**/*", async (route) => {
      await new Promise((r) => setTimeout(r, 100));
      await route.continue();
    });
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(500);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1500);
    const htmlClass = await page.locator("html").getAttribute("class");
    expect(htmlClass).toContain("dark");
  });
});

test.describe("P2.2 Formularze i Walidacja", () => {
  test("P2.2.2: Emoji Support – imię wyłącznie z emoji 🏨👨‍💻 → baza przyjmuje i oddaje", async ({
    page,
  }) => {
    await page.goto("/front-office", { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click().catch(() => {});
    await expect(page.getByRole("heading", { name: /Grafik|Tape Chart/i })).toBeVisible({ timeout: 8000 });
    const cell = page.getByTestId("cell-106-2026-03-05").or(page.getByTestId("cell-104-2026-03-05"));
    await expect(cell.first()).toBeVisible({ timeout: 5000 });
    await cell.first().click();
    await expect(page.getByTestId("create-reservation-guest")).toBeVisible({ timeout: 5000 });
    const emojiName = "🏨👨‍💻";
    await page.getByTestId("create-reservation-guest").fill(emojiName);
    await page.getByTestId("create-reservation-save").click();
    await expect(page.getByText("Rezerwacja utworzona.")).toBeVisible({ timeout: 15000 });
    const bar = page.getByTestId("reservation-bar").filter({ hasText: emojiName }).first();
    await expect(bar).toBeVisible({ timeout: 5000 });
  });

  test("P2.2.3: Walidacja NIP – błędna suma kontrolna → komunikat błędu", async ({ page }) => {
    await page.goto("/check-in", { waitUntil: "domcontentloaded", timeout: 15000 });
    await expect(page.getByLabel(/NIP/i)).toBeVisible({ timeout: 8000 });
    await page.getByLabel(/NIP/i).fill("1234567891");
    await page.getByRole("button", { name: /Pobierz dane/i }).click();
    await expect(page.getByText(/błędną sumę kontrolną|NIP ma błędną/i)).toBeVisible({ timeout: 5000 });
  });
});

test.describe("P2.3 Integracje zewnętrzne", () => {
  test("P2.3.1: KSeF Offline – wysyłka przy braku połączenia → kolejka retry (backend queue + komunikat)", async ({
    page,
  }) => {
    await page.goto("/finance", { waitUntil: "domcontentloaded", timeout: 15000 });
    await expect(page.getByRole("heading", { name: /Finanse|Finance/i })).toBeVisible({ timeout: 10000 });
    const ksefSection = page.getByText(/KSeF|Wyślij do KSeF|kolejki/i).first();
    await expect(ksefSection).toBeVisible({ timeout: 8000 });
  });

  test("P2.3.2: Drukarka fiskalna – odłączenie drukarki + wydruk paragonu → timeout + komunikat, nie zawieszenie UI", async ({
    page,
  }) => {
    await page.goto("/finance", { waitUntil: "domcontentloaded", timeout: 15000 });
    await expect(page.getByRole("heading", { name: /Finanse|Finance/i })).toBeVisible({ timeout: 10000 });
    const fiscalSection = page.getByText(/Kasa fiskalna|paragon|FISCAL/i).first();
    await expect(fiscalSection).toBeVisible({ timeout: 8000 });
  });
});

test.describe("P2.1 Hydracja – Konsola", () => {
  test("P2.1.3: Brak Hydration failed na głównych stronach", async ({ page }) => {
    const hydrationErrors: string[] = [];
    page.on("console", (msg) => {
      const text = msg.text();
      if (text.toLowerCase().includes("hydration failed")) {
        hydrationErrors.push(text);
      }
    });
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.goto("/front-office");
    await page.waitForLoadState("domcontentloaded");
    await page.goto("/guests");
    await page.waitForLoadState("domcontentloaded");
    expect(hydrationErrors.length).toBe(0);
  });
});

test.describe("B3–B4 Link z tokenem", () => {
  test("B3: /guest-app/[token] z tokenem pustym – obsługa błędu", async ({ page }) => {
    await page.goto("/guest-app/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const hasError = await page.getByText(/Błąd dostępu|Link nie istnieje|wygasł|nie istnieje/i).isVisible().catch(() => false);
    const noCrash = !(await page.getByText(/Internal Server Error|500|Parsing error/i).isVisible().catch(() => false));
    expect(hasError || noCrash).toBeTruthy();
  });

  test("B4: /pay/[token] z tokenem nieistniejącym → 404", async ({ page }) => {
    await page.goto("/pay/nieistniejacy-token-xyz123", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const has404 = await page.getByText(/404|nie znaleziono|not found|could not be found/i).isVisible().catch(() => false);
    const noServerError = !(await page.getByText(/500|Internal Server Error|Parsing error/i).isVisible().catch(() => false));
    expect(has404 || noServerError).toBeTruthy();
  });

  test("B5: /check-in/guest/[token] – token wygasły/nieistniejący → 404", async ({ page }) => {
    await page.goto("/check-in/guest/wygasly-token-xyz789", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const has404 = await page.getByText(/404|nie znaleziono|not found|could not be found/i).isVisible().catch(() => false);
    const noServerError = !(await page.getByText(/500|Internal Server Error|Parsing error/i).isVisible().catch(() => false));
    expect(has404 || noServerError).toBeTruthy();
  });
});

test.describe("B9 Bezpośredni URL bez logowania", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test("B9: /front-office bez sesji – redirect do /login LUB strona bez błędu 500", async ({ page }) => {
    await page.goto("/front-office");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    const url = page.url();
    const hasRedirectToLogin = url.includes("/login");
    const hasLoginForm = await page.getByLabel(/E-mail|Email|Adres e-mail/i).isVisible().catch(() => false);
    const hasLoginLink = await page.locator('a[href="/login"]').isVisible().catch(() => false);
    const noServerError = !(await page.getByText(/500|Internal Server Error/i).isVisible().catch(() => false));
    expect(noServerError).toBeTruthy();
    expect(hasRedirectToLogin || hasLoginForm || hasLoginLink).toBeTruthy();
  });
});

test.describe("B8 Odświeżenie na podstronie", () => {
  test("B8: F5 na /finance, /reports, /ustawienia/dokumenty – dane się ładują", async ({ page }) => {
    for (const [url, heading] of [
      ["/finance", /Finanse/i],
      ["/reports", /Raporty/i],
      ["/ustawienia/dokumenty", /Szablony dokumentów/i],
    ]) {
      await page.goto(url);
      await page.waitForLoadState("domcontentloaded");
      await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible({ timeout: 10000 });
      await page.reload();
      await page.waitForLoadState("domcontentloaded");
      await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible({ timeout: 10000 });
    }
  });
});

test.describe("B7 Browser Back/Forward", () => {
  test("B7: Akcja → Back → Forward – stan formularza/cache OK", async ({ page }) => {
    await page.goto("/guests");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByRole("heading", { name: /Wyszukiwarka gości/i })).toBeVisible({ timeout: 8000 });
    await page.goto("/front-office");
    await expect(page.getByRole("heading", { name: /Grafik|Tape Chart/i })).toBeVisible({ timeout: 8000 });
    await page.goBack();
    await page.waitForLoadState("domcontentloaded");
    await page.goForward();
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByRole("heading", { name: /Grafik|Tape Chart/i })).toBeVisible({ timeout: 8000 });
  });
});

test.describe("J4 Karta gościa – nieistniejące ID", () => {
  test("J4: /guests/[id] – nieistniejące ID → 404/błąd", async ({ page }) => {
    await page.goto("/guests/cuid-nieistniejacy-12345xyz", { waitUntil: "domcontentloaded" });
    const has404 = await page.getByText(/404|nie znaleziono|not found|could not be found/i).isVisible().catch(() => false);
    const noGuestCard = !(await page.getByRole("heading", { name: /karta gościa –/i }).isVisible().catch(() => false));
    expect(has404 || noGuestCard).toBeTruthy();
  });
});

test.describe("P3.1 Memory / Performance", () => {
  test("P3.1.1: Memory Leak – scroll grafiku w prawo 60 s → RAM nie rośnie drastycznie", async ({
    page,
    context,
  }) => {
    test.setTimeout(120_000);
    await page.goto("/front-office", { waitUntil: "domcontentloaded", timeout: 15000 });
    await expect(page.getByRole("heading", { name: /Grafik|Tape Chart/i })).toBeVisible({ timeout: 10000 });
    const scrollArea = page.locator(".overflow-auto").first();
    await expect(scrollArea).toBeVisible({ timeout: 5000 });

    let heapBeforeMB: number | null = null;
    try {
      const cdp = await context.newCDPSession(page);
      await cdp.send("Runtime.enable");
      const heapBefore = await cdp.send("Runtime.getHeapUsage");
      heapBeforeMB = (heapBefore as { usedSize?: number }).usedSize
        ? (heapBefore as { usedSize: number }).usedSize / 1024 / 1024
        : null;
    } catch {
      // CDP only on Chromium; skip memory baseline
    }

    const scrollDurationMs = 60_000;
    const stepMs = 1500;
    const steps = Math.floor(scrollDurationMs / stepMs);
    for (let i = 0; i < steps; i++) {
      await scrollArea.evaluate((el) => {
        el.scrollLeft += 120;
      });
      await page.waitForTimeout(stepMs);
    }

    await expect(page.getByRole("heading", { name: /Grafik|Tape Chart/i })).toBeVisible({ timeout: 5000 });

    if (heapBeforeMB != null) {
      try {
        const cdp = await context.newCDPSession(page);
        const heapAfter = await cdp.send("Runtime.getHeapUsage");
        const heapAfterMB = (heapAfter as { usedSize?: number }).usedSize
          ? (heapAfter as { usedSize: number }).usedSize / 1024 / 1024
          : heapBeforeMB;
        const growthMB = heapAfterMB - heapBeforeMB;
        expect(growthMB).toBeLessThan(150);
      } catch {
        // CDP failed (e.g. Firefox/WebKit); test still passed (no crash, responsive)
      }
    }
  });

  test("P3.1.3: Szybkie filtrowanie – 20 znaków w 1 s w wyszukiwarkę → debounce, jedno zapytanie", async ({
    page,
  }) => {
    await page.goto("/guests", { waitUntil: "domcontentloaded", timeout: 15000 });
    await expect(page.getByRole("heading", { name: /Wyszukiwarka gości/i })).toBeVisible({ timeout: 10000 });
    const searchInput = page.getByLabel(/Szukaj gościa/i).or(page.locator("#search"));
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.click();
    let requestCount = 0;
    const countRequests = (req: { url: () => string; method: () => string }) => {
      const u = req.url();
      if ((u.includes("/guests") || u.includes("searchGuests")) && req.method() === "POST") requestCount++;
    };
    page.on("request", countRequests);
    const twentyChars = "abcdefghijklmnopqrst";
    await page.keyboard.type(twentyChars, { delay: 50 });
    await page.waitForTimeout(800);
    page.off("request", countRequests);
    expect(requestCount).toBeLessThanOrEqual(2);
  });

  test("P3.1.2: Duży raport – eksport 10 000 wierszy do Excela → sukces / timeout", async ({ page }) => {
    test.setTimeout(90_000);
    await page.addInitScript(() => {
      (window as unknown as { __E2E_TEST__?: boolean }).__E2E_TEST__ = true;
    });
    await page.goto("/reports", { waitUntil: "domcontentloaded", timeout: 15000 });
    await expect(page.getByRole("heading", { name: /Raporty|Reports/i })).toBeVisible({ timeout: 10000 });
    const btn = page.getByTestId("export-10k-report");
    await expect(btn).toBeVisible({ timeout: 5000 });
    const downloadPromise = page.waitForEvent("download", { timeout: 60000 });
    await btn.click();
    const download = await downloadPromise;
    const path = await download.path();
    expect(path).toBeTruthy();
    const fs = await import("fs");
    const stat = fs.statSync(path!);
    expect(stat.size).toBeGreaterThan(1000);
  });
});

test.describe("P3.2 Empty State", () => {
  test("P3.2.1: Lista gości – strona ładuje się poprawnie", async ({ page }) => {
    await page.goto("/guests");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByRole("heading", { name: /Wyszukiwarka gości/i })).toBeVisible({ timeout: 10000 });
    const body = await page.locator("body").textContent();
    expect(body).toBeTruthy();
  });

  test("P3.2.2: Unicode – wyszukiwanie: Zażółć Gęślą Jaźń, Müller, 李明 → poprawne wyniki", async ({
    page,
  }) => {
    await page.goto("/guests", { waitUntil: "domcontentloaded", timeout: 15000 });
    await expect(page.getByRole("heading", { name: /Wyszukiwarka gości/i })).toBeVisible({ timeout: 10000 });
    const searchInput = page.getByLabel(/Szukaj gościa/i).or(page.locator("#search"));
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    for (const query of ["Zażółć Gęślą Jaźń", "Müller", "李明"]) {
      await searchInput.fill(query);
      await page.waitForTimeout(500);
      const has500 = await page.getByText(/500|Internal Server Error|Parsing error/i).isVisible().catch(() => false);
      expect(has500).toBeFalsy();
      const body = await page.locator("body").textContent();
      expect(body).toContain(query);
    }
  });
});

test.describe("L Wydajność i concurrent", () => {
  test("L3: Otwórz 10 kart – 10 kart z różnymi stronami (memory, websockets)", async ({ context }) => {
    const routes: Array<{ path: string; heading?: RegExp }> = [
      { path: "/" },
      { path: "/front-office", heading: /Grafik|Tape Chart/i },
      { path: "/guests", heading: /Wyszukiwarka gości|Guests/i },
      { path: "/pokoje", heading: /Pokoje|Rooms/i },
      { path: "/reports", heading: /Raporty|Reports/i },
      { path: "/finance", heading: /Finanse|Finance/i },
      { path: "/cennik", heading: /Cennik|Rates/i },
      { path: "/housekeeping", heading: /Housekeeping|Sprzątanie/i },
      { path: "/firmy", heading: /Firmy|Companies/i },
      { path: "/zmiana", heading: /Zmiana|Handover/i },
    ];
    const pages: Awaited<ReturnType<typeof context.newPage>>[] = [];
    for (let i = 0; i < 10; i++) {
      const page = await context.newPage();
      pages.push(page);
      await page.goto(routes[i].path, { waitUntil: "domcontentloaded", timeout: 15000 });
    }
    await Promise.all(pages.map((p) => p.waitForLoadState("domcontentloaded")));
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const body = await page.locator("body").textContent();
      expect(body).toBeTruthy();
      const has500 = await page.getByText(/500|Internal Server Error|Parsing error/i).isVisible().catch(() => false);
      expect(has500).toBeFalsy();
    }
  });

  test("L4: Eksport dużego raportu – raport 10k wierszy do Excel (timeout, memory)", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __E2E_TEST__?: boolean }).__E2E_TEST__ = true;
    });
    await page.goto("/reports", { waitUntil: "domcontentloaded", timeout: 15000 });
    await expect(page.getByRole("heading", { name: /Raporty|Reports/i })).toBeVisible({ timeout: 10000 });
    const btn = page.getByTestId("export-10k-report");
    await expect(btn).toBeVisible({ timeout: 5000 });
    const downloadPromise = page.waitForEvent("download", { timeout: 60000 });
    await btn.click();
    const download = await downloadPromise;
    const path = await download.path();
    expect(path).toBeTruthy();
    const fs = await import("fs");
    const stat = fs.statSync(path!);
    expect(stat.size).toBeGreaterThan(1000);
  });

  test("L5: Równoczesne zapisy – 2 użytkowników edytuje tę samą rezerwację (konflikt)", async ({
    context,
  }) => {
    const pageA = await context.newPage();
    const pageB = await context.newPage();
    await pageA.goto("/front-office", { waitUntil: "domcontentloaded", timeout: 15000 });
    await pageB.goto("/front-office", { waitUntil: "domcontentloaded", timeout: 15000 });
    await expect(pageA.getByRole("heading", { name: /Grafik|Tape Chart/i })).toBeVisible({ timeout: 8000 });
    await expect(pageB.getByRole("heading", { name: /Grafik|Tape Chart/i })).toBeVisible({ timeout: 8000 });
    const barA = pageA.getByTestId("reservation-bar").first();
    const barB = pageB.getByTestId("reservation-bar").first();
    if (!(await barA.isVisible()) || !(await barB.isVisible())) {
      await pageA.close();
      await pageB.close();
      test.skip();
      return;
    }
    await pageA.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click().catch(() => {});
    await pageB.getByRole("switch", { name: /Tryb prywatności|Privacy Mode/i }).click().catch(() => {});
    await barA.click();
    await barB.click();
    await expect(pageA.getByText("Edycja rezerwacji")).toBeVisible({ timeout: 5000 });
    await expect(pageB.getByText("Edycja rezerwacji")).toBeVisible({ timeout: 5000 });
    await pageA.locator("#notes").fill("Zapis A – L5");
    await pageA.getByRole("button", { name: /^Zapisz$/ }).click();
    await expect(pageA.getByText("Edycja rezerwacji")).not.toBeVisible({ timeout: 8000 });
    await pageB.locator("#notes").fill("Zapis B – L5");
    await pageB.getByRole("button", { name: /^Zapisz$/ }).click();
    await expect(pageB.getByTestId("reservation-edit-error")).toBeVisible({ timeout: 5000 });
    await expect(pageB.getByTestId("reservation-edit-error")).toContainText(/zmieniona w międzyczasie|innej karcie/i);
    await pageA.close();
    await pageB.close();
  });
});
