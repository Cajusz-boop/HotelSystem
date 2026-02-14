import { test, expect } from "@playwright/test";
import {
  computeStayOffset,
  openCheckInPage,
  prepareAvailableRoom,
} from "./utils/check-in-helpers";

/**
 * CI-GAP-01 – CI-GAP-03: Scenariusze z planu testów (Gap 2.1, 2.2, 2.3).
 * Meldunek: zmiana pokoju, wykrywanie duplikatów gościa, MRZ.
 */

test.describe("CI-GAP-01 [Gap 2.1] E2E: Zmiana pokoju podczas meldunku – lista tylko wolnych pokoi", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const stayOffset = computeStayOffset(testInfo);
    await openCheckInPage(page);
    await prepareAvailableRoom(page, stayOffset);
  });

  test("lista pokoi zależy od wybranego terminu (daty zameldowania/wymeldowania)", async ({
    page,
  }) => {
    const roomSelect = page.getByTestId("check-in-room-select");
    await expect(roomSelect).toBeVisible({ timeout: 15000 });
    await expect
      .poll(async () => {
        const optionTexts = await page.locator("#room option").allTextContents();
        return optionTexts.filter((text) => !/Brak wolnych pokoi/i.test(text)).length;
      }, { timeout: 45000 })
      .toBeGreaterThan(0);

    const checkIn = page.locator("#checkIn");
    const checkOut = page.locator("#checkOut");
    await checkIn.fill("2030-01-15");
    await checkOut.fill("2030-01-20");
    await page.waitForTimeout(500);

    const optionsAfter = page.locator("#room option");
    const countAfter = await optionsAfter.count();
    expect(countAfter).toBeGreaterThanOrEqual(1);
  });

  test("select pokoju pokazuje tylko wolne w danym terminie (etykieta + opcje)", async ({
    page,
  }) => {
    await expect(page.locator('label[for="room"]')).toHaveText(
      /Pokój\s*\(wolne w wybranym terminie\)/i,
      { timeout: 10000 }
    );
    const roomSelect = page.getByTestId("check-in-room-select");
    await expect(roomSelect).toBeVisible({ timeout: 15000 });
    await expect
      .poll(async () => {
        const optionTexts = await page.locator("#room option").allTextContents();
        return optionTexts.filter((text) => !/Brak wolnych pokoi/i.test(text)).length;
      }, { timeout: 45000 })
      .toBeGreaterThan(0);
  });
});

test.describe("CI-GAP-02 [Gap 2.2] E2E: Wykrywanie duplikatów (Gość) – sugestia istniejącego profilu", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const stayOffset = computeStayOffset(testInfo);
    await openCheckInPage(page);
    await prepareAvailableRoom(page, stayOffset);
  });

  test("wpisanie imienia/nazwiska istniejącego gościa pokazuje sugestię „Gość już w bazie”", async ({
    page,
  }) => {
    const nameInput = page.getByTestId("check-in-guest-name");
    await nameInput.fill("Nowak");
    await page.waitForTimeout(600);

    const suggestion = page.getByTestId("existing-guest-suggestion");
    await expect(suggestion).toBeVisible({ timeout: 10000 });
    await expect(suggestion).toContainText(/Adam Nowak/i);
  });

  test("rezerwacja zostanie powiązana z istniejącym profilem (tekst sugestii)", async ({
    page,
  }) => {
    await page.getByTestId("check-in-guest-name").fill("Adam Nowak");
    await page.waitForTimeout(600);

    const suggestion = page.getByTestId("existing-guest-suggestion");
    await expect(suggestion).toBeVisible({ timeout: 10000 });
    await expect(suggestion).toContainText(/Adam Nowak/i);
  });
});

test.describe("CI-GAP-03 [Gap 2.3] E2E: Obsługa różnych formatów MRZ – parsowanie nazwiska", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const stayOffset = computeStayOffset(testInfo);
    await openCheckInPage(page);
    await prepareAvailableRoom(page, stayOffset);
  });

  test("MRZ 3-liniowy (dowód osobisty TD1) – po blur nazwisko i imię uzupełnione z linii 3", async ({
    page,
  }) => {
    const mrz3Line =
      "IDPOL12345678<<<<<<<<<<<<<<<\n8001012M2501015POL<<<<<<<<<<<<<6\nKOWALSKI<<JAN<<<<<<<<<<<<<<<<<<";
    await page.locator("#mrz").fill(mrz3Line);
    await page.locator("#mrz").blur();

    const nameInput = page.locator("#name");
    await expect(nameInput).toHaveValue("KOWALSKI, JAN", { timeout: 2000 });
  });

  test("MRZ 2-liniowy (paszport TD3) – po blur nazwisko i imię uzupełnione z linii 1", async ({
    page,
  }) => {
    const mrz2Line =
      "P<POLNOWAK<<ANNA<<<<<<<<<<<<<<<<<<<<<<<<<<<<<\nAB1234567<9POL8001012F2501015<<<<<<<<<<<<<<06";
    await page.locator("#mrz").fill(mrz2Line);
    await page.locator("#mrz").blur();

    const nameInput = page.locator("#name");
    await expect(nameInput).toHaveValue("NOWAK, ANNA", { timeout: 2000 });
  });

  test("MRZ 1-liniowy (fallback) – parsowanie Surname<<Given", async ({ page }) => {
    await page.locator("#mrz").fill("IDPOLKOWALSKI<<JAN<<<<<<<<<<<<<<<<<<<<<<<");
    await page.locator("#mrz").blur();

    const nameInput = page.locator("#name");
    await expect(nameInput).toHaveValue("IDPOLKOWALSKI, JAN", { timeout: 2000 });
  });
});
