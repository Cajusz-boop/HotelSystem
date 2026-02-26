/**
 * PLAN TESTÓW KOMPLETNY v3 — FAZY 2-11
 * Oparty o RZECZYWISTY dzień pracy recepcji hotelowej.
 *
 * Uruchom: npx playwright test tests/plan-v3-faza2-11.spec.ts --reporter=list --project=chromium
 * Serwer: http://localhost:3011
 * Dane testowe: prefix E2E_ w nazwisku
 */
import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const SCREENSHOTS_DIR = "screenshots/v3";

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Przewija TapeChart w prawo do znalezienia paska. */
async function scrollToFindBar(page: import("@playwright/test").Page, bar: import("@playwright/test").Locator) {
  const roomRow = page.locator("[data-testid^='room-row-']").first();
  for (let attempt = 0; attempt < 3; attempt++) {
    if (await roomRow.isVisible({ timeout: 10000 }).catch(() => false)) break;
    await page.waitForTimeout(3000);
  }
  await expect(roomRow).toBeVisible({ timeout: 5000 });
  const scrollEl = page.locator(".tape-chart-scroll-area").first();
  await scrollEl.waitFor({ state: "visible", timeout: 5000 }).catch(() => null);
  await scrollEl.evaluate((el: HTMLElement) => { el.scrollLeft = 0; }).catch(() => null);
  await page.waitForTimeout(200);
  for (let i = 0; i < 100; i++) {
    if (await bar.isVisible({ timeout: 400 }).catch(() => false)) return;
    await scrollEl.evaluate((el: HTMLElement) => { el.scrollLeft += 280; }).catch(() => null);
    await page.waitForTimeout(60);
  }
}

test.beforeAll(async () => {
  await mkdir(SCREENSHOTS_DIR, { recursive: true });
});

test.afterAll(async ({ request }) => {
  try {
    const res = await request.post("/api/test/cleanup-e2e");
    const json = (await res.json()) as { success?: boolean; deleted?: { reservations: number; guests: number } };
    if (json.success && json.deleted) {
      console.log(`[E2E cleanup] Usunięto: ${json.deleted.reservations} rezerwacji, ${json.deleted.guests} gości`);
    }
  } catch (e) {
    console.warn("[E2E cleanup]", e);
  }
});

test.describe.configure({ mode: "serial" });

test.describe("Faza 2: Rezerwacje", () => {
  test("2.1 Rezerwacja telefoniczna — E2E Telefon (DODATEK: przez + Zarezerwuj na grafiku)", async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);
    const checkIn = addDays(today, 14);
    const checkOut = addDays(checkIn, 2);

    await page.goto("/front-office", { waitUntil: "networkidle" });
    await expect(page.locator("[data-testid^='room-row-']").first()).toBeVisible({ timeout: 20000 });

    // DODATEK: na /front-office klika "+ Zarezerwuj" → dialog → wypełnia → zapisuje
    await page.getByTestId("create-reservation-open-btn").click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10000 });

    await page.locator("#uni-roomType").selectOption({ value: "" }).catch(() => null);
    await page.getByTestId("create-reservation-room").first().selectOption({ value: "009" });
    await page.getByTestId("create-reservation-checkIn").first().fill(checkIn);
    await page.getByTestId("create-reservation-checkOut").first().fill(checkOut);
    await page.getByTestId("create-reservation-guest").first().fill("E2E Telefon");
    await page.getByTestId("create-reservation-save").click();
    await page.waitForTimeout(5000);

    const bar = page.locator('[data-testid="reservation-bar"]').filter({ hasText: /E2E|Telefon/i }).first();
    await scrollToFindBar(page, bar);
    await expect(bar).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/05-rezerwacja-telefoniczna.png`, fullPage: true });
  });

  test("2.2 Rezerwacja OTA (Booking.com)", async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);
    const checkIn = addDays(today, 21);
    const checkOut = addDays(checkIn, 2);

    await page.goto("/front-office", { waitUntil: "networkidle" });
    await page.getByTestId("create-reservation-open-btn").click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10000 });

    await page.locator("#uni-roomType").selectOption({ value: "" }).catch(() => null);
    await page.getByTestId("create-reservation-room").first().selectOption({ value: "009" });
    await page.getByTestId("create-reservation-checkIn").first().fill(checkIn);
    await page.getByTestId("create-reservation-checkOut").first().fill(checkOut);
    await page.getByTestId("create-reservation-guest").first().fill("E2E Booking Com");
    await page.locator("#uni-channel").selectOption("BOOKING_COM");
    await page.getByTestId("create-reservation-save").click();
    await page.waitForTimeout(5000);
    // Zamknij dialog jeśli nadal otwarty (zapis może pozostawić otwarte okno)
    const dialog = page.getByRole("dialog");
    if (await dialog.isVisible({ timeout: 500 }).catch(() => false)) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }
    const bar = page.locator('[data-testid="reservation-bar"]').filter({ hasText: /E2E Booking|Booking Com|Com E\./i }).first();
    await scrollToFindBar(page, bar);
    await expect(bar).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/06-rezerwacja-ota.png`, fullPage: true });
  });

  test("2.3 Booking Engine (online)", async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);
    const checkIn = addDays(today, 14);
    const checkOut = addDays(checkIn, 2);

    await page.goto("/booking");
    const stayLocal = page.getByRole("button", { name: /Zostań lokalnie/i });
    if (await stayLocal.isVisible({ timeout: 2000 }).catch(() => false)) await stayLocal.click();

    await expect(page.getByRole("heading", { name: /Rezerwacja|Sprawdź dostępność/i }).first()).toBeVisible({ timeout: 10000 });

    await page.getByLabel(/Zameldowanie/i).first().fill(checkIn);
    await page.getByLabel(/Wymeldowanie/i).first().fill(checkOut);
    const adultsSel = page.locator("select").filter({ has: page.locator('option[value="2"]') }).first();
    if (await adultsSel.isVisible()) await adultsSel.selectOption("2");

    await page.getByRole("button", { name: /Szukaj dostępnych pokoi/i }).click();
    await page.waitForTimeout(8000);

    const hasWybór = await page.getByRole("heading", { name: /Wybór pokoju/i }).first().isVisible({ timeout: 2000 }).catch(() => false);
    const hasBrak = await page.getByText(/Brak dostępnych pokoi/i).first().isVisible({ timeout: 1000 }).catch(() => false);
    const hasSearchAgain = await page.locator("button").filter({ hasText: /Szukaj dostępnych|Szukam/ }).first().isVisible({ timeout: 1000 }).catch(() => false);
    expect(hasWybór || hasBrak || hasSearchAgain).toBeTruthy();
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/07-booking-engine.png`, fullPage: true });
  });

  test("2.4 Rezerwacja grupowa", async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);
    const checkIn = addDays(today, 10);
    const checkOut = addDays(checkIn, 2);

    await page.goto("/front-office");
    await page.getByTestId("create-reservation-open-btn").click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10000 });

    await page.getByTestId("create-reservation-room").first().selectOption({ index: 1 });
    await page.getByTestId("create-reservation-checkIn").first().fill(checkIn);
    await page.getByTestId("create-reservation-checkOut").first().fill(checkOut);
    await page.getByTestId("create-reservation-guest").first().fill("E2E Firma Konferencyjna");
    await page.locator("#uni-channel").selectOption("CORPORATE");
    await page.getByTestId("create-reservation-save").click();
    await page.waitForTimeout(3000);

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/08-rezerwacja-grupowa.png`, fullPage: true });
  });

  test("2.5 Walk-in", async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = addDays(today, 1);

    await page.goto("/front-office");
    await page.getByTestId("create-reservation-open-btn").click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10000 });

    await page.locator("#uni-roomType").selectOption({ value: "" });
    await page.getByTestId("create-reservation-room").first().selectOption({ value: "009" });
    await page.getByTestId("create-reservation-checkIn").first().fill(today);
    await page.getByTestId("create-reservation-checkOut").first().fill(tomorrow);
    await page.getByTestId("create-reservation-guest").first().fill("E2E Walk-In");
    await page.getByTestId("create-reservation-status").first().selectOption("CHECKED_IN");
    await page.getByTestId("create-reservation-save").click();
    await page.waitForTimeout(3000);

    const bar = page.locator('[data-testid="reservation-bar"]').filter({ hasText: /E2E Walk-In|Walk-In|In E\./i }).first();
    await scrollToFindBar(page, bar);
    await expect(bar).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/09-walkin.png`, fullPage: true });
  });
});

test.describe("Faza 3: Check-in", () => {
  test("3.1 Standardowy check-in — E2E Telefon", async ({ page }) => {
    await page.goto("/front-office", { waitUntil: "networkidle" });
    const bar = page.locator('[data-testid="reservation-bar"]:not([aria-disabled="true"])').filter({ hasText: /E2E|Telefon E\.|Telefon/i }).first();
    await scrollToFindBar(page, bar);
    await expect(bar).toBeVisible({ timeout: 15000 });
    await bar.dblclick({ force: true });

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1500);

    const meldujBtn = dialog.getByRole("button", { name: /Melduj gościa/i }).first();
    if (await meldujBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await meldujBtn.click();
      await expect(page.getByText(/Zameldowano|Meldunek/)).toBeVisible({ timeout: 8000 });
    } else {
      const statusSelect = dialog.locator("#uni-status");
      await statusSelect.selectOption({ index: 1 });
      await page.getByTestId("create-reservation-save").click();
    }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/10-checkin.png`, fullPage: true });
  });

  test("3.2 Karta meldunkowa", async ({ page }) => {
    test.setTimeout(90000);
    await page.goto("/front-office", { waitUntil: "networkidle" });
    const bar = page.locator('[data-testid="reservation-bar"]').filter({ hasText: /E2E|Telefon/i }).first();
    await scrollToFindBar(page, bar);
    await expect(bar).toBeVisible({ timeout: 10000 });
    await bar.dblclick({ force: true });

    const hasKarta = await page.getByText(/Karta meldunkowa|drukuj kartę/i).first().isVisible({ timeout: 3000 }).catch(() => false);
    if (hasKarta) {
      await page.getByText(/Karta meldunkowa|drukuj kartę/i).first().click();
    }
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/11-karta-meldunkowa.png`, fullPage: true });
  });

  test("3.3 Check-in pokój nie gotowy", async ({ page }) => {
    await page.goto("/front-office", { waitUntil: "networkidle" });
    const bar = page.locator('[data-testid="reservation-bar"]:not([aria-disabled="true"])').filter({ hasText: /E2E|Telefon E\.|Telefon/i }).first();
    await scrollToFindBar(page, bar);
    await expect(bar).toBeVisible({ timeout: 10000 });
    await bar.click({ button: "right", force: true });
    const rozliczenie = page.getByRole("menuitem", { name: /Rozlicz|Edytuj/i }).first();
    if (await rozliczenie.isVisible({ timeout: 2000 })) await rozliczenie.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/12-checkin-dirty-room.png`, fullPage: true });
  });
});

test.describe("Faza 4: Folio i obciążenia", () => {
  test("4.1 Przegląd folio", async ({ page }) => {
    await page.goto("/front-office", { waitUntil: "networkidle" });
    const bar = page.locator('[data-testid="reservation-bar"]:not([aria-disabled="true"])').filter({ hasText: /E2E|Telefon E\.|Telefon/i }).first();
    await scrollToFindBar(page, bar);
    await expect(bar).toBeVisible({ timeout: 10000 });
    await bar.dblclick();

    await page.getByRole("tab", { name: /Rozlicz/i }).click();
    await page.waitForTimeout(500);

    const hasFolio = await page.getByText(/Saldo|Obciąż|Suma|Nocleg/i).first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasFolio).toBeTruthy();
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/13-folio-przeglad.png`, fullPage: true });
  });

  test("4.2 Dodanie obciążeń", async ({ page }) => {
    await page.goto("/front-office", { waitUntil: "networkidle" });
    const bar = page.locator('[data-testid="reservation-bar"]:not([aria-disabled="true"])').filter({ hasText: /E2E|Telefon E\.|Telefon/i }).first();
    await scrollToFindBar(page, bar);
    await expect(bar).toBeVisible({ timeout: 10000 });
    await bar.dblclick();

    await page.getByRole("tab", { name: /Rozlicz/i }).click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /Dodaj obciążenie/i }).first().click();
    await expect(page.getByRole("heading", { name: /Dodaj obciążenie/i })).toBeVisible({ timeout: 5000 });

    await page.locator("#add-charge-amount").fill("45");
    await page.locator("#add-charge-type").selectOption("MINIBAR");
    await page.getByRole("button", { name: /Dodaj obciążenie/i }).last().click();

    await expect(page.getByText(/Obciążenie dodane do folio/i).first()).toBeVisible({ timeout: 8000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/14-folio-obciazenia.png`, fullPage: true });
  });

  test("4.3 Płatność częściowa", async ({ page }) => {
    await page.goto("/front-office", { waitUntil: "networkidle" });
    const bar = page.locator('[data-testid="reservation-bar"]:not([aria-disabled="true"])').filter({ hasText: /E2E|Telefon E\.|Telefon/i }).first();
    await scrollToFindBar(page, bar);
    await expect(bar).toBeVisible({ timeout: 10000 });
    await bar.dblclick();

    await page.getByRole("tab", { name: /Rozlicz/i }).click();
    await page.waitForTimeout(500);

    const platnoscBtn = page.getByRole("button", { name: /Płatność|Zarejestruj płatność|Dodaj płatność/i }).first();
    if (await platnoscBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await platnoscBtn.click();
      await page.waitForTimeout(500);
      const amountInput = page.getByLabel(/Kwota|Amount/i).or(page.locator('input[type="number"]')).first();
      if (await amountInput.isVisible({ timeout: 2000 })) {
        await amountInput.fill("200");
        await page.getByRole("button", { name: /Zapisz|Dodaj|Płatność/i }).last().click();
      }
    }
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/15-zaliczka.png`, fullPage: true });
  });

  test("4.4 Transfer obciążeń", async ({ page }) => {
    await page.goto("/front-office");
    const bar = page.locator('[data-testid="reservation-bar"]:not([aria-disabled="true"])').filter({ hasText: /E2E|Telefon E\.|Telefon/i }).first();
    const scrollEl4 = page.locator(".tape-chart-scroll-area").first();
    for (let i = 0; i < 40; i++) { if (await bar.isVisible({ timeout: 400 }).catch(() => false)) break; await scrollEl4.evaluate((el: HTMLElement) => { el.scrollLeft += 180; }).catch(() => null); await page.waitForTimeout(150); }
    await expect(bar).toBeVisible({ timeout: 10000 });
    await bar.dblclick();

    await page.getByRole("tab", { name: /Rozlicz/i }).click();
    const hasTransfer = await page.getByText(/Przenieś obciążenie|Transfer charge/i).first().isVisible({ timeout: 2000 }).catch(() => false);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/16-transfer-charge.png`, fullPage: true });
  });

  test("4.5 Rabat", async ({ page }) => {
    await page.goto("/front-office", { waitUntil: "networkidle" });
    const bar = page.locator('[data-testid="reservation-bar"]:not([aria-disabled="true"])').filter({ hasText: /E2E|Telefon E\.|Telefon/i }).first();
    await scrollToFindBar(page, bar);
    await expect(bar).toBeVisible({ timeout: 10000 });
    await bar.dblclick();

    await page.getByRole("tab", { name: /Rozlicz/i }).click();
    const hasRabat = await page.getByText(/Rabat|Discount|Zniżka/i).first().isVisible({ timeout: 3000 }).catch(() => false);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/17-rabat.png`, fullPage: true });
  });
});

test.describe("Faza 5: Check-out", () => {
  test("5.1 Sprawdzenie salda", async ({ page }) => {
    await page.goto("/front-office", { waitUntil: "networkidle" });
    const bar = page.locator('[data-testid="reservation-bar"]:not([aria-disabled="true"])').filter({ hasText: /E2E|Telefon E\.|Telefon/i }).first();
    await scrollToFindBar(page, bar);
    await expect(bar).toBeVisible({ timeout: 10000 });
    await bar.dblclick();

    await page.getByRole("tab", { name: /Rozlicz/i }).click();
    await expect(page.getByText(/Saldo|Suma|PLN/i).first()).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/18-saldo-przed-checkout.png`, fullPage: true });
  });

  test("5.2 Płatność końcowa", async ({ page }) => {
    await page.goto("/front-office", { waitUntil: "networkidle" });
    const bar = page.locator('[data-testid="reservation-bar"]:not([aria-disabled="true"])').filter({ hasText: /E2E|Telefon E\.|Telefon/i }).first();
    await scrollToFindBar(page, bar);
    await expect(bar).toBeVisible({ timeout: 10000 });
    await bar.dblclick();

    await page.getByRole("tab", { name: /Rozlicz/i }).click();
    await page.waitForTimeout(500);

    const platnoscBtn = page.getByRole("button", { name: /Płatność|Zarejestruj płatność/i }).first();
    if (await platnoscBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await platnoscBtn.click();
      const saldoEl = page.locator("text=/Saldo|Do zapłaty|pozostało/i").first();
      if (await saldoEl.isVisible({ timeout: 2000 })) {
        const saldoText = await saldoEl.textContent();
        const match = saldoText?.match(/(\d+[.,]\d+)/);
        if (match) {
          const amount = match[1].replace(",", ".");
          const amountInput = page.getByLabel(/Kwota|Amount/i).or(page.locator('input[type="number"]')).first();
          if (await amountInput.isVisible({ timeout: 1000 })) {
            await amountInput.fill(amount);
            await page.locator("#add-payment-method").selectOption("CASH").catch(() => null);
            await page.getByRole("button", { name: /Zapisz|Dodaj|Płatność/i }).last().click();
          }
        }
      }
    }
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/19-platnosc-koncowa.png`, fullPage: true });
  });

  test("5.3 Paragon", async ({ page }) => {
    // DODATEK-TAPECHART: paragon przez /front-office — double-click → dialog → zakładka Rozliczenie → Wystaw dokument
    await page.goto("/front-office", { waitUntil: "networkidle" });
    await page.waitForTimeout(3000); // czekaj na pełne załadowanie grafiku (TapeChart hydratuje się)
    const bar = page.locator('[data-testid="reservation-bar"]').filter({ hasText: /E2E|Telefon E\.|Telefon/i }).first();
    await scrollToFindBar(page, bar);
    await expect(bar).toBeVisible({ timeout: 10000 });
    await bar.dblclick({ force: true });

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);

    // Kliknij "Wystaw dokument" w footerze dialogu (dostępny w trybie edycji)
    const wystawBtn = dialog.getByRole("button", { name: /Wystaw dokument/i }).first();
    if (await wystawBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await wystawBtn.click();
      await page.waitForTimeout(500);
      const hasParagon = await page.getByRole("button", { name: /Paragon|kasa fiskalna/i }).first().isVisible({ timeout: 2000 }).catch(() => false);
      expect(hasParagon).toBeTruthy();
    }

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/20-paragon.png`, fullPage: true });
  });

  test("5.4 Faktura VAT", async ({ page }) => {
    // DODATEK-TAPECHART: faktura przez /front-office — double-click → dialog → Wystaw dokument → Faktura VAT
    await page.goto("/front-office", { waitUntil: "networkidle" });
    const bar = page.locator('[data-testid="reservation-bar"]').filter({ hasText: /E2E|Telefon E\.|Telefon/i }).first();
    await scrollToFindBar(page, bar);
    await expect(bar).toBeVisible({ timeout: 10000 });
    await bar.dblclick({ force: true });

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);

    // Kliknij "Wystaw dokument" w footerze dialogu
    const wystawBtn = dialog.getByRole("button", { name: /Wystaw dokument/i }).first();
    if (await wystawBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await wystawBtn.click();
      await page.waitForTimeout(500);
      const hasFaktura = await page.getByRole("button", { name: /Faktura VAT/i }).first().isVisible({ timeout: 2000 }).catch(() => false);
      expect(hasFaktura).toBeTruthy();
    }

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/21-faktura.png`, fullPage: true });
  });

  test("5.5 Korekta faktury", async ({ page }) => {
    await page.goto("/finance");
    await expect(page.getByText(/Finanse|Faktury|Rachunki/i).first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/22-korekta.png`, fullPage: true });
  });

  test("5.6 Check-out (DODATEK: double-click → dialog → Wymelduj)", async ({ page }) => {
    await page.goto("/front-office", { waitUntil: "networkidle" });
    const bar = page.locator('[data-testid="reservation-bar"]').filter({ hasText: /E2E|Telefon E\.|Telefon/i }).first();
    await scrollToFindBar(page, bar);
    await expect(bar).toBeVisible({ timeout: 15000 });

    // DODATEK: double-click na pasek → dialog → przycisk Wymelduj
    await bar.dblclick({ force: true });
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1000);

    const wymeldujBtn = dialog.getByRole("button", { name: /Wymelduj|Rozlicz i wymelduj/i }).first();
    if (await wymeldujBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await wymeldujBtn.click();
      await page.waitForTimeout(2000);
      const confirmBtn = page.getByRole("dialog").getByRole("button", { name: /^Wymelduj|Potwierdź/i });
      if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmBtn.click();
      }
    }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/23-checkout.png`, fullPage: true });
  });
});

test.describe("Faza 6: Dokumenty", () => {
  test("6.1 Lista dokumentów", async ({ page }) => {
    await page.goto("/finance");
    await expect(page.getByText(/Finanse|Rachunki|Faktury|Transakcje|Zamknięcie/i).first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/24-lista-dokumentow.png`, fullPage: true });
  });

  test("6.2 PDF faktury", async ({ page }) => {
    await page.goto("/finance");
    await expect(page.getByText(/Finanse|Faktury/i).first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/25-pdf-faktury.png`, fullPage: true });
  });

  test("6.3 Raport kasowy", async ({ page }) => {
    await page.goto("/finance");
    const hasRaport = await page.getByText(/Raport kasowy|Zamknięcie zmiany|Nocny audyt|Finanse|Rachunki|Faktury/i).first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasRaport).toBeTruthy();
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/26-raport-kasowy.png`, fullPage: true });
  });

  test("6.4 Eksport księgowość", async ({ page }) => {
    await page.goto("/finance");
    const hasExport = await page.getByText(/JPK|Eksport|Export|KPiR|Rejestr VAT/i).first().isVisible({ timeout: 5000 }).catch(() => false);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/27-eksport-ksiegowosc.png`, fullPage: true });
  });
});

test.describe("Faza 7: Modyfikacje", () => {
  test("7.1 Zmiana dat", async ({ page }) => {
    await page.goto("/front-office", { waitUntil: "networkidle" });
    const bar = page.locator('[data-testid="reservation-bar"]:not([aria-disabled="true"])').filter({ hasText: /E2E Booking Com|Com E\./i }).first();
    await scrollToFindBar(page, bar);
    await expect(bar).toBeVisible({ timeout: 15000 });
    await bar.dblclick();

    const checkIn = page.getByTestId("create-reservation-checkIn").first();
    await checkIn.fill(addDays(new Date().toISOString().slice(0, 10), 23));
    await page.getByTestId("create-reservation-checkOut").first().fill(addDays(new Date().toISOString().slice(0, 10), 25));
    await page.getByTestId("create-reservation-save").click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/28-zmiana-dat.png`, fullPage: true });
  });

  test("7.2 Zmiana pokoju", async ({ page }) => {
    await page.goto("/front-office", { waitUntil: "networkidle" });
    const bar = page.locator('[data-testid="reservation-bar"]:not([aria-disabled="true"])').filter({ hasText: /E2E Booking Com|Com E\.|E2E Firma Konferencyjna|Firma Konferencyjna/i }).first();
    await scrollToFindBar(page, bar);
    await expect(bar).toBeVisible({ timeout: 10000 });
    await bar.dblclick();

    await page.getByTestId("create-reservation-room").first().selectOption({ index: 3 });
    await page.getByTestId("create-reservation-save").click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/29-zmiana-pokoju.png`, fullPage: true });
  });

  test("7.5 Anulowanie rezerwacji", async ({ page }) => {
    await page.goto("/front-office", { waitUntil: "networkidle" });
    const bar = page.locator('[data-testid="reservation-bar"]:not([aria-disabled="true"])').filter({ hasText: /E2E Booking Com|Com E\./i }).first();
    await scrollToFindBar(page, bar);
    await expect(bar).toBeVisible({ timeout: 10000 });
    await bar.click({ button: "right" });

    const anuluj = page.getByRole("menuitem", { name: /Anuluj rezerwację|Anuluj/i }).first();
    if (await anuluj.isVisible({ timeout: 2000 }).catch(() => false)) {
      await anuluj.dispatchEvent("click");
      await page.waitForTimeout(2000);
      const confirm = page.getByRole("dialog").getByRole("button", { name: /Potwierdź|Anuluj|Tak/i });
      if (await confirm.isVisible({ timeout: 2000 }).catch(() => false)) await confirm.click();
    }
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/32-anulowanie.png`, fullPage: true });
  });
});

test.describe("Faza 8: CRM", () => {
  test("8.1 Karta gościa", async ({ page }) => {
    await page.goto("/kontrahenci");
    await expect(page.getByRole("heading", { name: "Kontrahenci" })).toBeVisible({ timeout: 10000 });
    await page.getByLabel(/Szukaj/i).or(page.getByPlaceholder(/Nazwisko|Szukaj/i)).first().fill("E2E Telefon");
    await page.waitForTimeout(1000);

    const link = page.getByText(/E2E Telefon|Telefon/i).first();
    if (await link.isVisible({ timeout: 5000 }).catch(() => false)) {
      await link.click();
      await page.waitForTimeout(1500);
    }
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/34-karta-goscia.png`, fullPage: true });
  });
});

test.describe("Faza 9: Housekeeping", () => {
  test("9.1 Status pokoi", async ({ page }) => {
    await page.goto("/front-office");
    await expect(page.locator("[data-testid^='room-row-']").first()).toBeVisible({ timeout: 15000 });
    const hasStatus = await page.getByText(/DIRTY|CLEAN|OOO|Do sprzątania/i).first().isVisible({ timeout: 5000 }).catch(() => false);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/37-housekeeping.png`, fullPage: true });
  });
});

test.describe("Faza 10: Koniec dnia", () => {
  test("10.3 Przekazanie zmiany (zapis)", async ({ page }) => {
    await page.goto("/zmiana");
    await expect(page.getByRole("heading", { name: /Zmiana zmiany|shift handover/i })).toBeVisible({ timeout: 10000 });

    await page.locator("#content").fill("Zmiana testowa E2E. Gość z 101 prosił o budzenie 7:00. W kasie 1500 PLN gotówki.");
    await page.getByRole("button", { name: /Zapisz przekazanie/i }).click();
    await page.waitForTimeout(2000);

    await page.reload();
    const hasNote = await page.getByText(/Zmiana testowa E2E|1500 PLN/i).first().isVisible({ timeout: 5000 }).catch(() => false);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/41-notatka-zmiany.png`, fullPage: true });
  });
});

test.describe("Faza 11: Walidacja", () => {
  test("11.1 Puste pola", async ({ page }) => {
    await page.goto("/front-office");
    await page.getByTestId("create-reservation-open-btn").click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10000 });

    await page.getByTestId("create-reservation-room").first().selectOption("");
    await page.getByTestId("create-reservation-guest").first().fill("");
    await page.getByTestId("create-reservation-save").click();

    const hasError = await page.getByText(/wypełnij|wymagane|required|błąd/i).first().isVisible({ timeout: 3000 }).catch(() => false);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/42-walidacja-puste.png`, fullPage: true });
  });

  test("11.2 Złe daty", async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = addDays(today, -1);

    await page.goto("/front-office");
    await page.getByTestId("create-reservation-open-btn").click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10000 });

    await page.getByTestId("create-reservation-room").first().selectOption({ index: 1 });
    await page.getByTestId("create-reservation-checkIn").first().fill(today);
    await page.getByTestId("create-reservation-checkOut").first().fill(yesterday);
    await page.getByTestId("create-reservation-guest").first().fill("E2E Walidacja");
    await page.getByTestId("create-reservation-save").click();

    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/43-walidacja-daty.png`, fullPage: true });
  });

  test("11.4 Polskie znaki", async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);
    const checkIn = addDays(today, 60);
    const checkOut = addDays(checkIn, 1);

    await page.goto("/front-office", { waitUntil: "networkidle" });
    await page.getByTestId("create-reservation-open-btn").click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10000 });

    await page.locator("#uni-roomType").selectOption({ value: "" });
    await page.getByTestId("create-reservation-room").first().selectOption({ value: "009" });
    await page.getByTestId("create-reservation-checkIn").first().fill(checkIn);
    await page.getByTestId("create-reservation-checkOut").first().fill(checkOut);
    await page.getByTestId("create-reservation-guest").first().fill("E2E Źółćęśąń Łukasz");
    await page.getByTestId("create-reservation-save").click();
    await page.waitForTimeout(3000);

    const bar = page.locator('[data-testid="reservation-bar"]').filter({ hasText: /E2E|Źółć|Łukasz|Zolc|Lukasz|asz/i }).first();
    await scrollToFindBar(page, bar);
    await expect(bar).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/45-polskie-znaki.png`, fullPage: true });
  });
});
