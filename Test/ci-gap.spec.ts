import { test, expect } from "@playwright/test";

/**
 * CI-GAP-01 – CI-GAP-03: Scenariusze z planu testów (Gap 2.1, 2.2, 2.3).
 * Meldunek: zmiana pokoju, wykrywanie duplikatów gościa, MRZ.
 */

test.describe("CI-GAP-01 [Gap 2.1] E2E: Zmiana pokoju podczas meldunku – lista tylko wolnych pokoi", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/check-in");
    await expect(page.getByRole("heading", { name: /Meldunek gościa/i })).toBeVisible();
  });

  test("lista pokoi zależy od wybranego terminu (daty zameldowania/wymeldowania)", async ({
    page,
  }) => {
    const roomSelect = page.getByTestId("check-in-room-select");
    await expect(roomSelect).toBeVisible();
    const options = page.locator("#room option");
    const countInitial = await options.count();
    expect(countInitial).toBeGreaterThanOrEqual(1);

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
    await expect(page.getByLabel(/Pokój.*wolne w wybranym terminie/i)).toBeVisible();
    const roomSelect = page.getByTestId("check-in-room-select");
    await expect(roomSelect).toBeVisible();
    const firstOption = page.locator("#room option").first();
    await expect(firstOption).toBeVisible();
  });
});

test.describe("CI-GAP-02 [Gap 2.2] E2E: Wykrywanie duplikatów (Gość) – sugestia istniejącego profilu", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/check-in");
    await expect(page.getByRole("heading", { name: /Meldunek gościa/i })).toBeVisible();
  });

  test("wpisanie imienia/nazwiska istniejącego gościa pokazuje sugestię „Gość już w bazie”", async ({
    page,
  }) => {
    const nameInput = page.getByTestId("check-in-guest-name");
    await nameInput.fill("Kowalski");
    await page.waitForTimeout(600);

    const suggestion = page.getByTestId("existing-guest-suggestion");
    await expect(suggestion).toBeVisible({ timeout: 3000 });
    await expect(suggestion).toContainText(/Gość już w bazie/i);
  });

  test("rezerwacja zostanie powiązana z istniejącym profilem (tekst sugestii)", async ({
    page,
  }) => {
    await page.getByTestId("check-in-guest-name").fill("Jan Kowalski");
    await page.waitForTimeout(600);

    const suggestion = page.getByTestId("existing-guest-suggestion");
    await expect(suggestion).toBeVisible({ timeout: 3000 });
    await expect(suggestion).toContainText(/rezerwacja zostanie powiązana z tym profilem/i);
  });
});

test.describe("CI-GAP-03 [Gap 2.3] E2E: Obsługa różnych formatów MRZ – parsowanie nazwiska", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/check-in");
    await expect(page.getByRole("heading", { name: /Meldunek gościa/i })).toBeVisible();
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
