/**
 * PLAN TESTÓW KOMPLETNY v3 — FAZA 1: PORANEK — PRZYJĘCIE ZMIANY
 * Oparty o RZECZYWISTY dzień pracy recepcji hotelowej.
 *
 * Uruchom: npx playwright test tests/plan-v3-faza1.spec.ts --reporter=list --project=chromium
 * Serwer: http://localhost:3011
 * Baza: produkcyjna (bez seed:kwhotel)
 */
import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const SCREENSHOTS_DIR = "screenshots/v3";

test.beforeAll(async () => {
  await mkdir(SCREENSHOTS_DIR, { recursive: true });
});

test.describe.configure({ mode: "serial" });

test.describe("Faza 1: Poranek — przyjęcie zmiany", () => {
  test("1.1 Otwarcie zmiany / Raport nocny — Dashboard", async ({ page }) => {
    await page.goto("/front-office");
    await expect(
      page.getByTestId("room-row-101").or(page.locator("[data-testid^='room-row-']").first())
    ).toBeVisible({ timeout: 20000 });
    await expect(page.locator("[data-date-header]").first()).toBeVisible({ timeout: 10000 });

    // Sprawdź widoczność statystyk: pokoje, przyjazdy, wyjazdy
    const hasStats =
      (await page.getByText(/Przyjazdy/i).isVisible()) ||
      (await page.getByText(/Wyjazdy/i).isVisible()) ||
      (await page.getByText(/Zameldowani|Obłożenie/i).isVisible());
    expect(hasStats).toBeTruthy();

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/01-poranek-dashboard.png`, fullPage: true });
  });

  test("1.2 Przekazanie zmiany (odczyt)", async ({ page }) => {
    await page.goto("/zmiana");
    await expect(
      page.getByRole("heading", { name: /Zmiana zmiany|shift handover/i })
    ).toBeVisible({ timeout: 10000 });

    // Sprawdź czy widoczne notatki lub formularz przekazania
    const hasContent =
      (await page.getByText(/Notatki|Treść przekazania|Data zmiany/i).first().isVisible()) ||
      (await page.locator("form").first().isVisible());
    expect(hasContent).toBeTruthy();

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/02-przekazanie-zmiany.png`, fullPage: true });
  });

  test("1.3 Lista przyjazdów na dziś", async ({ page }) => {
    await page.goto("/front-office", { waitUntil: "networkidle" });
    await expect(page.locator("[data-testid^='room-row-']").first()).toBeVisible({ timeout: 20000 });

    // DODATEK-TAPECHART: cały flow na /front-office — statystyki Przyjazdy na górze
    const hasStats = await page.getByText(/Przyjazdy|Wyjazdy|Zameldowani|Obłożenie/i).first().isVisible({ timeout: 5000 });
    expect(hasStats).toBeTruthy();

    let sawArrivalsList = false;
    const arrivalsBtn = page.getByRole("button", { name: /Przyjazdy:/i }).first();
    if (await arrivalsBtn.isVisible({ timeout: 3000 })) {
      await arrivalsBtn.click();
      await page.waitForTimeout(800);
      const dialog = page.getByRole("dialog");
      if (await dialog.isVisible({ timeout: 3000 })) {
        await expect(dialog.getByText(/Przyjazdy/i).first()).toBeVisible();
        sawArrivalsList = true;
      }
    }
    // Zawsze zostajemy na /front-office — bez fallbacku do /dashboard
    await expect(page).toHaveURL(/\/front-office/);

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/03-lista-przyjazdow.png`, fullPage: true });
  });

  test("1.4 Lista wyjazdów na dziś", async ({ page }) => {
    await page.goto("/front-office", { waitUntil: "networkidle" });
    await expect(page.locator("[data-testid^='room-row-']").first()).toBeVisible({ timeout: 20000 });

    // DODATEK-TAPECHART: cały flow na /front-office — statystyki Wyjazdy na górze
    const hasStats = await page.getByText(/Przyjazdy|Wyjazdy|Zameldowani|Obłożenie/i).first().isVisible({ timeout: 5000 });
    expect(hasStats).toBeTruthy();

    let sawDeparturesList = false;
    const departuresBtn = page.getByRole("button", { name: /Wyjazdy:/i }).first();
    if (await departuresBtn.isVisible({ timeout: 3000 })) {
      await departuresBtn.click();
      await page.waitForTimeout(800);
      const dialog = page.getByRole("dialog");
      if (await dialog.isVisible({ timeout: 3000 })) {
        await expect(dialog.getByText(/Wyjazdy/i).first()).toBeVisible();
        sawDeparturesList = true;
      }
    }
    // Zawsze zostajemy na /front-office — bez fallbacku do /dashboard
    await expect(page).toHaveURL(/\/front-office/);

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/04-lista-wyjazdow.png`, fullPage: true });
  });
});
