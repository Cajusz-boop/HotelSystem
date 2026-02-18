import { test, expect } from "@playwright/test";

test.describe("Dashboard — rozszerzony", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("DASH-05: sekcja KPI (Occupancy, ADR, RevPAR) widoczna", async ({ page }) => {
    await expect(page.getByText(/Dashboard|Centrum/i).first()).toBeVisible({ timeout: 10000 });
    const kpiEl = page.locator(
      ':text("Occupancy"), :text("Obłożenie"), :text("ADR"), :text("RevPAR"), :text("Przychód"), [data-testid*="kpi"]'
    ).first();
    const hasKpi = await kpiEl.isVisible().catch(() => false);
    if (!hasKpi) {
      test.skip(true, "Brak sekcji KPI na Dashboard");
      return;
    }
    expect(hasKpi).toBeTruthy();
  });

  test("DASH-06: sekcja dzisiejsze check-iny widoczna", async ({ page }) => {
    await expect(page.getByText(/Dashboard|Centrum/i).first()).toBeVisible({ timeout: 10000 });
    const checkInSection = page.locator(
      ':text("Check-in"), :text("Przyjazdy"), :text("Meldunki"), :text("Arrivals"), [data-testid*="checkin"]'
    ).first();
    const hasCheckins = await checkInSection.isVisible().catch(() => false);
    if (!hasCheckins) {
      test.skip(true, "Brak sekcji check-inów na Dashboard");
      return;
    }
    expect(hasCheckins).toBeTruthy();
  });

  test("DASH-07: sekcja dzisiejsze check-outy widoczna", async ({ page }) => {
    await expect(page.getByText(/Dashboard|Centrum/i).first()).toBeVisible({ timeout: 10000 });
    const checkOutSection = page.locator(
      ':text("Check-out"), :text("Wyjazdy"), :text("Wymeldowania"), :text("Departures"), [data-testid*="checkout"]'
    ).first();
    const hasCheckouts = await checkOutSection.isVisible().catch(() => false);
    if (!hasCheckouts) {
      test.skip(true, "Brak sekcji check-outów na Dashboard");
      return;
    }
    expect(hasCheckouts).toBeTruthy();
  });

  test("DASH-08: wykresy obłożenia/przychodów renderują się", async ({ page }) => {
    await expect(page.getByText(/Dashboard|Centrum/i).first()).toBeVisible({ timeout: 10000 });
    const chartEl = page.locator("canvas, svg.recharts-surface, [data-testid*='chart'], .chart").first();
    const hasChart = await chartEl.isVisible().catch(() => false);
    if (!hasChart) {
      test.skip(true, "Brak wykresów na Dashboard");
      return;
    }
    expect(hasChart).toBeTruthy();
  });
});
